import express from "express";
import path from "node:path";
import fs from "node:fs";
import { SkillIndex, getSources, getSkillsForSource, buildTree } from "./index.js";
import { parseFrontmatter, extractFrontmatterRaw, stripFrontmatter } from "./frontmatter.js";
import type { HealthInfo } from "./types.js";

declare const __dirname: string;

function extractWildcard(params: Record<string, unknown>): string {
  const val = params.path;
  const raw = Array.isArray(val) ? val.join("/") : String(val);
  return raw.startsWith("/") ? raw : "/" + raw;
}

interface RefEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: RefEntry[];
}

function getReferenceFiles(skillPath: string): RefEntry[] {
  const skillDir = path.dirname(skillPath);
  const skillName = path.basename(skillPath);
  const refs: RefEntry[] = [];

  let items: string[];
  try { items = fs.readdirSync(skillDir); } catch { return refs; }

  for (const name of items.sort()) {
    if (name.startsWith(".")) continue;
    const full = path.join(skillDir, name);
    try {
      const stat = fs.statSync(full);
      if (stat.isFile() && name !== skillName && name.endsWith(".md")) {
        refs.push({ name, path: full, type: "file" });
      } else if (stat.isDirectory()) {
        const children: RefEntry[] = [];
        for (const sub of fs.readdirSync(full).sort()) {
          const subFull = path.join(full, sub);
          if (fs.statSync(subFull).isFile() && sub.endsWith(".md")) {
            children.push({ name: sub, path: subFull, type: "file" });
          }
        }
        if (children.length > 0) {
          refs.push({ name, path: full, type: "directory", children });
        }
      }
    } catch { continue; }
  }
  return refs;
}

export function createApp(index: SkillIndex) {
  const app = express();

  // Serve frontend
  const publicDir = path.resolve(__dirname, "..", "public");
  app.get("/", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  // --- API Routes ---

  app.use(express.json());

  app.get("/api/sources", (_req, res) => {
    res.json(getSources(index));
  });

  app.post("/api/projects", (req, res) => {
    const dir = req.body?.path as string | undefined;
    if (!dir) { res.status(400).json({ error: "Missing path" }); return; }
    const ok = index.addProjectDir(dir);
    if (!ok) { res.status(400).json({ error: "No .claude/ directory found at that path" }); return; }
    res.json({ ok: true, sources: getSources(index) });
  });

  app.delete("/api/projects", (req, res) => {
    const dir = req.body?.path as string | undefined;
    if (!dir) { res.status(400).json({ error: "Missing path" }); return; }
    index.removeProjectDir(dir);
    res.json({ ok: true, sources: getSources(index) });
  });

  app.get("/api/skills", (req, res) => {
    const source = req.query.source as string | undefined;
    if (!source) { res.json([]); return; }
    const skills = getSkillsForSource(source, index).map((s) => ({
      name: s.name,
      description: s.description,
      path: s.path,
      filename: s.filename,
      skill_dir: s.skillDir,
      old: s.old,
      health: s.health ? toSnakeHealth(s.health) : undefined,
      tool_references: s.toolReferences,
      structural_tags: s.structuralTags,
    }));
    res.json(skills);
  });

  app.get("/api/skill/*path", (req, res) => {
    const skillPath = extractWildcard(req.params as Record<string, unknown>);
    if (!fs.existsSync(skillPath)) { res.status(404).json({ error: "Skill not found" }); return; }

    try {
      const content = fs.readFileSync(skillPath, "utf-8");
      const frontmatter = parseFrontmatter(content);
      const frontmatterRaw = extractFrontmatterRaw(content);
      const body = stripFrontmatter(content);

      const response: Record<string, unknown> = {
        name: frontmatter.name || path.basename(skillPath, path.extname(skillPath)),
        description: frontmatter.description || "",
        frontmatter,
        frontmatter_raw: frontmatterRaw,
        content: body,
        path: skillPath,
        references: getReferenceFiles(skillPath),
      };

      const indexed = index.get(skillPath);
      if (indexed) {
        response.cross_references = indexed.crossReferences;
        response.tool_references = indexed.toolReferences;
        response.structural_tags = indexed.structuralTags;
        response.word_count = indexed.wordCount;
        response.health = toSnakeHealth(index.getHealth(skillPath)!);
        response.skill_dir = path.basename(skillPath) === "SKILL.md" ? path.dirname(skillPath) : null;
      }

      res.json(response);
    } catch (e: unknown) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get("/api/reference/*path", (req, res) => {
    const refPath = extractWildcard(req.params as Record<string, unknown>);
    if (!fs.existsSync(refPath)) { res.status(404).json({ error: "Reference not found" }); return; }

    try {
      const content = fs.readFileSync(refPath, "utf-8");
      res.json({ name: path.basename(refPath), content, path: refPath });
    } catch (e: unknown) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get("/api/search", (req, res) => {
    const query = (req.query.q as string) || "";
    const results = index.search(query).map((r) => ({
      name: r.name,
      description: r.description,
      path: r.path,
      source_type: r.sourceType,
      source_name: r.sourceName,
      snippet: r.snippet,
      structural_tags: r.structuralTags,
    }));
    res.json(results);
  });

  app.get("/api/graph", (_req, res) => {
    const graph = index.getGraph();
    res.json({
      nodes: graph.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        source_type: n.sourceType,
        source_name: n.sourceName,
        word_count: n.wordCount,
        structural_tags: n.structuralTags,
      })),
      edges: graph.edges,
    });
  });

  app.get("/api/skill-tree/*path", (req, res) => {
    const dirPath = extractWildcard(req.params as Record<string, unknown>);
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      res.status(404).json({ error: "Directory not found" });
      return;
    }
    res.json({ root: dirPath, tree: buildTree(dirPath) });
  });

  app.get("/api/health/*path", (req, res) => {
    const skillPath = extractWildcard(req.params as Record<string, unknown>);
    const health = index.getHealth(skillPath);
    if (!health) { res.status(404).json({ error: "Skill not found in index" }); return; }
    res.json(toSnakeHealth(health));
  });

  return app;
}

function toSnakeHealth(h: HealthInfo) {
  return {
    mtime: h.mtime,
    mtime_iso: h.mtimeIso,
    age_days: h.ageDays,
    word_count: h.wordCount,
    completeness_gaps: h.completenessGaps,
    tool_count: h.toolCount,
    cross_ref_count: h.crossRefCount,
    structural_tags: h.structuralTags,
  };
}
