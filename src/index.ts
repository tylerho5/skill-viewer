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
} from "./types.js";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PLUGINS_DIR = path.join(CLAUDE_DIR, "plugins", "cache", "claude-plugins-official");
const CUSTOM_SKILLS_DIR = path.join(CLAUDE_DIR, "skills");
const COMMANDS_DIR = path.join(CLAUDE_DIR, "commands");

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

  build(): void {
    this.skills = [];
    this.byPath = new Map();
    this.indexPlugins();
    this.indexCustomSkills();
    this.indexCommands();
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
        name: frontmatter.name || path.basename(filePath, path.extname(filePath)),
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
        } else {
          for (const md of readdir(itemPath)) {
            if (md.endsWith(".md") && isFile(path.join(itemPath, md))) {
              this.indexSkill(path.join(itemPath, md), "custom", "Custom Skills", itemPath);
              break;
            }
          }
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

// --- Sources scanning (not indexed, direct from disk) ---

export function getSources(): SourceInfo {
  const sources: SourceInfo = { plugins: [], custom: [], commands: [] };

  if (exists(PLUGINS_DIR)) {
    for (const pluginName of readdir(PLUGINS_DIR)) {
      const pluginDir = path.join(PLUGINS_DIR, pluginName);
      if (!isDir(pluginDir)) continue;
      const latestVersion = findLatestVersionDir(pluginDir);
      if (!latestVersion) continue;
      const skillsDir = path.join(latestVersion, "skills");
      if (!exists(skillsDir)) continue;
      const count = readdir(skillsDir).filter((name) => {
        const d = path.join(skillsDir, name);
        return isDir(d) && exists(path.join(d, "SKILL.md"));
      }).length;
      sources.plugins.push({
        name: pluginName,
        path: skillsDir,
        count,
        version: path.basename(latestVersion),
      });
    }
  }

  if (exists(CUSTOM_SKILLS_DIR)) {
    const count = readdir(CUSTOM_SKILLS_DIR).filter((n) => isDir(path.join(CUSTOM_SKILLS_DIR, n))).length;
    sources.custom.push({ name: "Custom Skills", path: CUSTOM_SKILLS_DIR, count });
  }

  if (exists(COMMANDS_DIR)) {
    const files = readdir(COMMANDS_DIR)
      .filter((n) => n.endsWith(".md") && isFile(path.join(COMMANDS_DIR, n)))
      .map((n) => ({ name: n.replace(/\.md$/, ""), path: path.join(COMMANDS_DIR, n) }));
    if (files.length > 0) {
      sources.commands.push({ name: "Commands", path: COMMANDS_DIR, count: files.length, files });
    }
  }

  return sources;
}

// --- Skills list for a source ---

export function getSkillsForSource(sourcePath: string, index: SkillIndex): SkillSummary[] {
  const skills: SkillSummary[] = [];

  if (sourcePath.includes("commands")) {
    if (exists(COMMANDS_DIR)) {
      for (const name of readdir(COMMANDS_DIR)) {
        const filePath = path.join(COMMANDS_DIR, name);
        if (!isFile(filePath) || !name.endsWith(".md")) continue;
        try {
          const content = readText(filePath);
          const fm = parseFrontmatter(content);
          skills.push({ name: fm.name || name.replace(/\.md$/, ""), description: fm.description || "", path: filePath, filename: name });
        } catch {
          skills.push({ name: name.replace(/\.md$/, ""), description: "", path: filePath, filename: name });
        }
      }
    }
  } else if (exists(sourcePath) && isDir(sourcePath)) {
    for (const name of readdir(sourcePath)) {
      const itemPath = path.join(sourcePath, name);
      if (isDir(itemPath)) {
        const skillFile = path.join(itemPath, "SKILL.md");
        if (exists(skillFile)) {
          try {
            const content = readText(skillFile);
            const fm = parseFrontmatter(content);
            skills.push({ name: fm.name || name, description: fm.description || "", path: skillFile, filename: "SKILL.md", skillDir: itemPath });
          } catch {
            skills.push({ name, description: "", path: skillFile, filename: "SKILL.md", skillDir: itemPath });
          }
        }
      } else if (isFile(itemPath) && name.endsWith(".md")) {
        try {
          const content = readText(itemPath);
          const fm = parseFrontmatter(content);
          skills.push({ name: fm.name || name.replace(/\.md$/, ""), description: fm.description || "", path: itemPath, filename: name });
        } catch {
          skills.push({ name: name.replace(/\.md$/, ""), description: "", path: itemPath, filename: name });
        }
      }
    }
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));

  for (const s of skills) {
    const indexed = index.get(s.path);
    if (indexed) {
      s.health = index.getHealth(s.path) ?? undefined;
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

export { CLAUDE_DIR, PLUGINS_DIR, CUSTOM_SKILLS_DIR, COMMANDS_DIR };
