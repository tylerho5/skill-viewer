import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parseFrontmatter, extractFrontmatterRaw, stripFrontmatter } from "./frontmatter.js";
import type {
  IndexedSkill,
  SkillSummary,
  HealthInfo,
  GraphData,
  SearchResult,
  TreeEntry,
  SourceInfo,
  AgentConfig,
} from "./types.js";

const AGENT_CONFIGS: AgentConfig[] = [
  {
    id: "claude",
    name: "Claude Code",
    globalDir: path.join(os.homedir(), ".claude"),
    projectDirName: ".claude",
    fileExtensions: [".md"],
    hasPlugins: true,
    subdirs: ["skills", "commands"],
    scanGlobalRoot: false,
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    globalDir: path.join(os.homedir(), ".gemini"),
    projectDirName: ".gemini",
    fileExtensions: [".md", ".toml"],
    hasPlugins: false,
    subdirs: ["skills", "commands"],
    scanGlobalRoot: false,
  },
  {
    id: "opencode",
    name: "OpenCode",
    globalDir: path.join(os.homedir(), ".config", "opencode"),
    projectDirName: ".opencode",
    fileExtensions: [".md"],
    hasPlugins: false,
    subdirs: ["skills", "commands", "agents"],
    scanGlobalRoot: false,
  },
  {
    id: "codex",
    name: "Codex CLI",
    globalDir: path.join(os.homedir(), ".codex"),
    projectDirName: ".codex",
    fileExtensions: [".md"],
    hasPlugins: false,
    subdirs: ["skills"],
    scanGlobalRoot: false,
  },
  {
    id: "cursor",
    name: "Cursor",
    globalDir: path.join(os.homedir(), ".cursor"),
    projectDirName: ".cursor",
    fileExtensions: [".md", ".mdc"],
    hasPlugins: false,
    subdirs: ["rules"],
    scanGlobalRoot: false,
  },
  {
    id: "cline",
    name: "Cline",
    globalDir: path.join(os.homedir(), "Documents", "Cline", "Rules"),
    projectDirName: ".clinerules",
    fileExtensions: [".md", ".txt"],
    hasPlugins: false,
    subdirs: [],
    scanGlobalRoot: true,
  },
];

function getAgentConfig(agentId: string): AgentConfig {
  return AGENT_CONFIGS.find((a) => a.id === agentId) || AGENT_CONFIGS[0];
}

let activeAgent = AGENT_CONFIGS[0];

let CLAUDE_DIR = activeAgent.globalDir;
let PLUGINS_DIR = path.join(CLAUDE_DIR, "plugins", "cache", "claude-plugins-official");
let CUSTOM_SKILLS_DIR = path.join(CLAUDE_DIR, "skills");
let COMMANDS_DIR = path.join(CLAUDE_DIR, "commands");

function updateDirs(agent: AgentConfig): void {
  CLAUDE_DIR = agent.globalDir;
  if (agent.id === "claude") {
    PLUGINS_DIR = path.join(CLAUDE_DIR, "plugins", "cache", "claude-plugins-official");
    CUSTOM_SKILLS_DIR = path.join(CLAUDE_DIR, "skills");
    COMMANDS_DIR = path.join(CLAUDE_DIR, "commands");
  } else {
    PLUGINS_DIR = "";
    CUSTOM_SKILLS_DIR = CLAUDE_DIR;
    COMMANDS_DIR = "";
    for (const sub of agent.subdirs) {
      const subDir = path.join(CLAUDE_DIR, sub);
      if (sub === "commands") COMMANDS_DIR = subDir;
      else if (sub === "rules") CUSTOM_SKILLS_DIR = subDir;
    }
  }
}

const KNOWN_TOOLS = new Set([
  "Agent", "Bash", "Edit", "Read", "Write", "Glob", "Grep",
  "WebFetch", "WebSearch", "TaskCreate", "TaskUpdate", "TodoWrite",
  "Skill", "NotebookEdit", "LSP",
]);

const SKILL_REF_RE = /\b[\w-]+:[\w-]+\b/g;

function exists(p: string): boolean {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function readdir(p: string): string[] {
  try { return fs.readdirSync(p); } catch { return []; }
}

function readText(p: string): string {
  return fs.readFileSync(p, "utf-8");
}

function isDir(p: string): boolean {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function isFile(p: string): boolean {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function mtime(p: string): number {
  try { return fs.statSync(p).mtimeMs / 1000; } catch { return 0; }
}

function findLatestVersionDir(pluginDir: string): string | null {
  const entries = readdir(pluginDir).filter((name) => {
    const full = path.join(pluginDir, name);
    return isDir(full) && (name[0] >= "0" && name[0] <= "9" || name === "unknown");
  });
  if (entries.length === 0) return null;
  entries.sort((a, b) => {
    if (a === "unknown") return 1;
    if (b === "unknown") return -1;
    return b.localeCompare(a);
  });
  return path.join(pluginDir, entries[0]);
}

export class SkillIndex {
  skills: IndexedSkill[] = [];
  private byPath = new Map<string, IndexedSkill>();
  private projectDirs = new Set<string>();

  getActiveAgent(): AgentConfig {
    return activeAgent;
  }

  setAgent(agentId: string): void {
    activeAgent = getAgentConfig(agentId);
    updateDirs(activeAgent);
    this.build();
  }

  build(): void {
    this.skills = [];
    this.byPath = new Map();
    if (activeAgent.id === "claude") {
      this.indexPlugins();
      this.indexCustomSkills();
      this.indexCommands();
    } else {
      this.indexGenericGlobalDir();
    }
    for (const dir of this.projectDirs) {
      this.indexProjectDir(dir);
    }
  }

  addProjectDir(projectDir: string): boolean {
    const configDir = path.join(projectDir, activeAgent.projectDirName);
    if (!exists(configDir) || !isDir(configDir)) return false;
    this.projectDirs.add(projectDir);
    this.indexProjectDir(projectDir);
    return true;
  }

  removeProjectDir(projectDir: string): void {
    this.projectDirs.delete(projectDir);
    const configDir = path.join(projectDir, activeAgent.projectDirName);
    this.skills = this.skills.filter((s) => !s.path.startsWith(configDir + path.sep));
    for (const [p] of this.byPath) {
      if (p.startsWith(configDir + path.sep)) this.byPath.delete(p);
    }
  }

  getProjectDirs(): string[] {
    return [...this.projectDirs];
  }

  private extractCrossReferences(content: string): string[] {
    const matches = content.match(SKILL_REF_RE) || [];
    return [...new Set(matches)].sort();
  }

  private extractToolReferences(content: string): string[] {
    const found: string[] = [];
    for (const tool of KNOWN_TOOLS) {
      const re = new RegExp(`\\b${tool}\\b`);
      if (re.test(content)) found.push(tool);
    }
    return found.sort();
  }

  private extractStructuralTags(content: string): string[] {
    const tags: string[] = [];
    if (/^[ \t]*-[ \t]*\[[ xX]\]/m.test(content)) tags.push("has-checklist");
    if (/examples?:|for example|e\.g\./i.test(content)) tags.push("has-examples");
    if (/```/.test(content)) tags.push("has-code-blocks");
    if (/^[ \t]*(\d+\.|step \d+)/im.test(content)) tags.push("has-steps");
    if (/^\|.+\|/m.test(content)) tags.push("has-table");
    if (/```\s*(mermaid|dot|plantuml)|graph (LR|TD|RL|BT)|digraph /i.test(content)) tags.push("has-diagram");
    return tags;
  }

  private indexSkill(
    filePath: string,
    sourceType: IndexedSkill["sourceType"],
    sourceName: string,
    skillDir: string,
  ): void {
    try {
      const content = readText(filePath);
      const frontmatter = parseFrontmatter(content);
      const body = stripFrontmatter(content);
      const mt = mtime(filePath);

      const skill: IndexedSkill = {
        name: frontmatter.name || (path.basename(filePath) === "SKILL.md" ? path.basename(path.dirname(filePath)) : path.basename(filePath, path.extname(filePath))),
        description: frontmatter.description || "",
        path: filePath,
        sourceType,
        sourceName,
        filename: path.basename(filePath),
        content: body,
        frontmatter,
        frontmatterRaw: extractFrontmatterRaw(content),
        crossReferences: this.extractCrossReferences(content),
        toolReferences: this.extractToolReferences(content),
        structuralTags: this.extractStructuralTags(body),
        wordCount: body.split(/\s+/).filter(Boolean).length,
        mtime: mt,
        skillDir,
      };
      this.skills.push(skill);
      this.byPath.set(filePath, skill);
    } catch {
      // skip unreadable files
    }
  }

  private indexPlugins(): void {
    if (!exists(PLUGINS_DIR)) return;
    for (const pluginName of readdir(PLUGINS_DIR)) {
      const pluginDir = path.join(PLUGINS_DIR, pluginName);
      if (!isDir(pluginDir)) continue;
      const latestVersion = findLatestVersionDir(pluginDir);
      if (!latestVersion) continue;
      const skillsDir = path.join(latestVersion, "skills");
      if (!exists(skillsDir)) continue;
      for (const skillName of readdir(skillsDir)) {
        const skillDir = path.join(skillsDir, skillName);
        if (!isDir(skillDir)) continue;
        const skillFile = path.join(skillDir, "SKILL.md");
        if (exists(skillFile)) {
          this.indexSkill(skillFile, "plugin", pluginName, skillDir);
        }
      }
    }
  }

  private indexCustomSkills(): void {
    if (!exists(CUSTOM_SKILLS_DIR)) return;
    for (const name of readdir(CUSTOM_SKILLS_DIR)) {
      const itemPath = path.join(CUSTOM_SKILLS_DIR, name);
      if (isDir(itemPath)) {
        const skillFile = path.join(itemPath, "SKILL.md");
        if (exists(skillFile)) {
          this.indexSkill(skillFile, "custom", "Custom Skills", itemPath);
        }
      } else if (isFile(itemPath) && itemPath.endsWith(".md")) {
        this.indexSkill(itemPath, "custom", "Custom Skills", path.dirname(itemPath));
      }
    }
  }

  private indexCommands(): void {
    if (!exists(COMMANDS_DIR)) return;
    for (const name of readdir(COMMANDS_DIR)) {
      const filePath = path.join(COMMANDS_DIR, name);
      if (isFile(filePath) && name.endsWith(".md")) {
        this.indexSkill(filePath, "command", "Commands", COMMANDS_DIR);
      }
    }
  }

  private hasMatchingExtension(filename: string): boolean {
    return activeAgent.fileExtensions.some((ext) => filename.endsWith(ext));
  }

  private indexGenericGlobalDir(): void {
    const globalDir = activeAgent.globalDir;
    if (!exists(globalDir) || !isDir(globalDir)) return;

    if (activeAgent.scanGlobalRoot) {
      this.indexGenericDir(globalDir, "custom", activeAgent.name, true);
    }

    for (const sub of activeAgent.subdirs) {
      const subDir = path.join(globalDir, sub);
      if (exists(subDir) && isDir(subDir)) {
        const sourceType = sub === "commands" ? "command" : "custom";
        const sourceName = sub === "commands" ? "Commands" : activeAgent.name;
        this.indexGenericDir(subDir, sourceType, sourceName, true);
      }
    }
  }

  private indexGenericDir(
    dir: string,
    sourceType: IndexedSkill["sourceType"],
    sourceName: string,
    recursive: boolean,
  ): void {
    for (const name of readdir(dir)) {
      if (name.startsWith(".")) continue;
      const itemPath = path.join(dir, name);
      if (isFile(itemPath) && this.hasMatchingExtension(name)) {
        this.indexSkill(itemPath, sourceType, sourceName, dir);
      } else if (recursive && isDir(itemPath)) {
        this.indexGenericDir(itemPath, sourceType, sourceName, true);
      }
    }
  }

  private indexProjectDir(projectDir: string): void {
    const configDir = path.join(projectDir, activeAgent.projectDirName);
    const projectName = path.basename(projectDir);

    if (activeAgent.id === "claude") {
      const cmdsDir = path.join(configDir, "commands");
      if (exists(cmdsDir) && isDir(cmdsDir)) {
        for (const name of readdir(cmdsDir)) {
          const filePath = path.join(cmdsDir, name);
          if (isFile(filePath) && name.endsWith(".md")) {
            this.indexSkill(filePath, "project", projectName, cmdsDir);
          }
        }
      }

      const skillsDir = path.join(configDir, "skills");
      if (exists(skillsDir) && isDir(skillsDir)) {
        for (const name of readdir(skillsDir)) {
          const itemPath = path.join(skillsDir, name);
          if (isDir(itemPath)) {
            const skillFile = path.join(itemPath, "SKILL.md");
            if (exists(skillFile)) {
              this.indexSkill(skillFile, "project", projectName, itemPath);
            }
          } else if (isFile(itemPath) && itemPath.endsWith(".md")) {
            this.indexSkill(itemPath, "project", projectName, skillsDir);
          }
        }
      }
    } else {
      if (!exists(configDir) || !isDir(configDir)) return;
      if (activeAgent.subdirs.length > 0) {
        for (const sub of activeAgent.subdirs) {
          const subDir = path.join(configDir, sub);
          if (exists(subDir) && isDir(subDir)) {
            const sourceType = sub === "commands" ? "command" : "project";
            this.indexGenericDir(subDir, sourceType, projectName, true);
          }
        }
      } else {
        this.indexGenericDir(configDir, "project", projectName, false);
      }
    }
  }

  get(skillPath: string): IndexedSkill | undefined {
    return this.byPath.get(skillPath);
  }

  search(query: string): SearchResult[] {
    if (!query) return [];
    const q = query.toLowerCase();
    const results: SearchResult[] = [];
    for (const skill of this.skills) {
      const haystack = `${skill.name} ${skill.description} ${skill.content}`.toLowerCase();
      if (!haystack.includes(q)) continue;
      const idx = skill.content.toLowerCase().indexOf(q);
      let snippet: string;
      if (idx >= 0) {
        const start = Math.max(0, idx - 80);
        const end = Math.min(skill.content.length, idx + query.length + 80);
        snippet = skill.content.slice(start, end).trim();
        if (start > 0) snippet = "…" + snippet;
        if (end < skill.content.length) snippet += "…";
      } else {
        snippet = skill.description;
      }
      results.push({
        name: skill.name,
        description: skill.description,
        path: skill.path,
        sourceType: skill.sourceType,
        sourceName: skill.sourceName,
        snippet,
        structuralTags: skill.structuralTags,
      });
    }
    return results;
  }

  getGraph(): GraphData {
    const nodes = this.skills.map((s) => ({
      id: s.path,
      name: s.name,
      sourceType: s.sourceType,
      sourceName: s.sourceName,
      wordCount: s.wordCount,
      structuralTags: s.structuralTags,
    }));

    const nameToPath = new Map<string, string>();
    for (const s of this.skills) {
      const refKey = `${s.sourceName.toLowerCase().replace(/ /g, "-")}:${s.name.toLowerCase()}`;
      nameToPath.set(refKey, s.path);
      nameToPath.set(s.name.toLowerCase(), s.path);
    }

    const edges: { source: string; target: string }[] = [];
    const seen = new Set<string>();
    for (const skill of this.skills) {
      for (const ref of skill.crossReferences) {
        const targetPath = nameToPath.get(ref.toLowerCase());
        if (targetPath && targetPath !== skill.path) {
          const key = `${skill.path}->${targetPath}`;
          if (!seen.has(key)) {
            seen.add(key);
            edges.push({ source: skill.path, target: targetPath });
          }
        }
      }
    }

    return { nodes, edges };
  }

  getHealth(skillPath: string): HealthInfo | null {
    const skill = this.byPath.get(skillPath);
    if (!skill) return null;

    const ageDays = (Date.now() / 1000 - skill.mtime) / 86400;
    const completenessGaps: string[] = [];
    if (!skill.description) completenessGaps.push("missing-description");
    if (!skill.structuralTags.includes("has-examples")) completenessGaps.push("no-examples");
    if (skill.wordCount < 50) completenessGaps.push("very-short");

    return {
      mtime: skill.mtime,
      mtimeIso: new Date(skill.mtime * 1000).toISOString(),
      ageDays: Math.round(ageDays * 10) / 10,
      wordCount: skill.wordCount,
      completenessGaps,
      toolCount: skill.toolReferences.length,
      crossRefCount: skill.crossReferences.length,
      structuralTags: skill.structuralTags,
    };
  }
}

// --- Sources (derived from index) ---

export function getSources(index: SkillIndex): SourceInfo {
  const sources: SourceInfo = { plugins: [], custom: [], commands: [], projects: [] };

  // Plugins (Claude only)
  if (activeAgent.id === "claude") {
    const pluginGroups = new Map<string, IndexedSkill[]>();
    for (const s of index.skills) {
      if (s.sourceType !== "plugin") continue;
      const group = pluginGroups.get(s.sourceName) || [];
      group.push(s);
      pluginGroups.set(s.sourceName, group);
    }
    for (const [name, skills] of pluginGroups) {
      const skillsDir = path.dirname(skills[0].skillDir);
      const version = path.basename(path.dirname(skillsDir));
      sources.plugins.push({
        name,
        path: skillsDir,
        count: skills.length,
        version,
        skills: skills.map((s) => ({ name: s.name, path: s.path })).sort((a, b) => a.name.localeCompare(b.name)),
      });
    }
  }

  // Custom skills
  const customSkills = index.skills.filter((s) => s.sourceType === "custom");
  if (customSkills.length > 0) {
    const sourceName = activeAgent.id === "claude" ? "Custom Skills" : activeAgent.name;
    const sourcePath = activeAgent.id === "claude" ? CUSTOM_SKILLS_DIR : activeAgent.globalDir;
    sources.custom.push({
      name: sourceName,
      path: sourcePath,
      count: customSkills.length,
      files: customSkills.map((s) => ({ name: s.name, path: s.path })).sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  // Commands
  const commandSkills = index.skills.filter((s) => s.sourceType === "command");
  if (commandSkills.length > 0) {
    sources.commands.push({
      name: "Commands",
      path: COMMANDS_DIR || path.join(activeAgent.globalDir, "commands"),
      count: commandSkills.length,
      files: commandSkills.map((s) => ({ name: s.name, path: s.path })).sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  // Projects
  for (const projectDir of index.getProjectDirs()) {
    const configDir = path.join(projectDir, activeAgent.projectDirName);
    const projectSkills = index.skills.filter((s) => s.path.startsWith(configDir + path.sep));
    const commandCount = projectSkills.filter((s) => {
      const rel = path.relative(configDir, s.path);
      return rel.startsWith("commands" + path.sep);
    }).length;
    sources.projects.push({
      name: path.basename(projectDir),
      path: configDir,
      projectDir,
      commandCount,
      skillCount: projectSkills.length - commandCount,
    });
  }

  return sources;
}

// --- Skills list for a source ---

function indexedToSummary(skill: IndexedSkill): SkillSummary {
  return {
    name: skill.name,
    description: skill.description,
    path: skill.path,
    filename: skill.filename,
    skillDir: skill.skillDir,
  };
}

export function getSkillsForSource(sourcePath: string, index: SkillIndex): SkillSummary[] {
  const matched = index.skills.filter((s) => s.path.startsWith(sourcePath + path.sep));
  const skills: SkillSummary[] = matched.map(indexedToSummary);
  skills.sort((a, b) => a.name.localeCompare(b.name));

  for (const s of skills) {
    s.health = index.getHealth(s.path) ?? undefined;
    const indexed = index.get(s.path);
    if (indexed) {
      s.toolReferences = indexed.toolReferences;
      s.structuralTags = indexed.structuralTags;
    }
  }

  return skills;
}

// --- File tree builder ---

export function buildTree(dirPath: string): TreeEntry[] {
  const entries: TreeEntry[] = [];
  let items: string[];
  try { items = fs.readdirSync(dirPath); } catch { return entries; }

  const dirs = items.filter((n) => !n.startsWith(".") && n !== "__pycache__" && isDir(path.join(dirPath, n))).sort();
  const files = items.filter((n) => {
    if (n.startsWith(".") && n !== ".claude-plugin") return false;
    return isFile(path.join(dirPath, n));
  }).sort();

  for (const name of dirs) {
    const full = path.join(dirPath, name);
    entries.push({ name, path: full, type: "directory", children: buildTree(full) });
  }

  for (const name of files) {
    const full = path.join(dirPath, name);
    const stat = fs.statSync(full);
    entries.push({ name, path: full, type: "file", size: stat.size, extension: path.extname(name) });
  }

  return entries;
}

export function getAgentConfigs(): AgentConfig[] {
  return AGENT_CONFIGS;
}

export function getWatchDirs(): string[] {
  if (activeAgent.id === "claude") {
    return [PLUGINS_DIR, CUSTOM_SKILLS_DIR, COMMANDS_DIR].filter((d) => exists(d) && isDir(d));
  }
  const dirs: string[] = [];
  if (activeAgent.scanGlobalRoot && exists(activeAgent.globalDir) && isDir(activeAgent.globalDir)) {
    dirs.push(activeAgent.globalDir);
  }
  for (const sub of activeAgent.subdirs) {
    const subDir = path.join(activeAgent.globalDir, sub);
    if (exists(subDir) && isDir(subDir)) dirs.push(subDir);
  }
  return dirs;
}

export { CLAUDE_DIR };
