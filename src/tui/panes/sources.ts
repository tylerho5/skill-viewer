import blessed from "neo-blessed";
import type { SkillIndex } from "../../index.js";
import { getSources } from "../../index.js";

export interface SourcesPaneHandle {
  refresh(): void;
  focus(): void;
  setActive(active: boolean): void;
  /** Called when a plugin/project source header is selected — populates pane 2 */
  onSelect(cb: (sourcePath: string) => void): void;
  /** Called when an individual skill entry is selected — bypasses pane 2 and goes straight to detail */
  onSelectSkill(cb: (skillPath: string, sourcePath: string) => void): void;
}

type RowType = "top_header" | "source_header" | "skill_entry";

interface Row {
  label: string;
  type: RowType;
  collapseKey: string;         // key used for the collapsed set (top_header or source_header)
  sourcePath: string | null;   // source_header: path to pass to pane 2
  skillPath: string | null;    // skill_entry: path of the individual skill
  sourcePathForSkill: string | null; // skill_entry: source path for pane 2
}

export function createSourcesPane(
  container: blessed.Widgets.BoxElement,
  index: SkillIndex,
): SourcesPaneHandle {
  const collapsed = new Set<string>();
  let selectCb: (p: string) => void = () => {};
  let selectSkillCb: (skillPath: string, sourcePath: string) => void = () => {};

  const list = blessed.list({
    parent: container,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    keys: true,
    mouse: true,
    style: {
      selected: { bg: "cyan", fg: "black", bold: true },
      item: { fg: "white", bold: true },
    },
    tags: true,
  });

  function setActive(active: boolean): void {
    const s = list.style as {
      selected: { bg: string; fg: string; bold?: boolean };
      item: { fg: string; bold?: boolean };
    };
    if (active) {
      s.item.fg = "white";
      s.item.bold = true;
      s.selected.bg = "cyan";
      s.selected.fg = "black";
      s.selected.bold = true;
    } else {
      s.item.fg = "gray";
      s.item.bold = false;
      s.selected.bg = "#222222";
      s.selected.fg = "white";
      s.selected.bold = false;
    }
    container.screen.render();
  }

  function buildRows(): Row[] {
    const sources = getSources(index);
    const rows: Row[] = [];

    // ── PLUGINS: two-level tree (plugin header → individual skills) ──────────
    {
      const key = "plugins";
      const total = sources.plugins.reduce((n, p) => n + p.count, 0);
      if (sources.plugins.length > 0) {
        const chevron = collapsed.has(key) ? "▸" : "▾";
        rows.push({ label: `${chevron} {bold}PLUGINS{/bold}  {gray-fg}${total}{/}`, type: "top_header", collapseKey: key, sourcePath: null, skillPath: null, sourcePathForSkill: null });
        if (!collapsed.has(key)) {
          for (const plugin of sources.plugins) {
            const subKey = `plugin:${plugin.name}`;
            const chevron2 = collapsed.has(subKey) ? "▸" : "▾";
            rows.push({ label: `  ${chevron2} {bold}${plugin.name}{/bold}  {gray-fg}${plugin.count}{/}`, type: "source_header", collapseKey: subKey, sourcePath: plugin.path, skillPath: null, sourcePathForSkill: null });
            if (!collapsed.has(subKey)) {
              for (const s of plugin.skills) {
                rows.push({ label: `      ${s.name}`, type: "skill_entry", collapseKey: subKey, sourcePath: null, skillPath: s.path, sourcePathForSkill: plugin.path });
              }
            }
          }
        }
      }
    }

    // ── USER SKILLS: flat individual skill entries ───────────────────────────
    {
      const key = "custom";
      const total = sources.custom.reduce((n, c) => n + c.count, 0);
      if (total > 0) {
        const chevron = collapsed.has(key) ? "▸" : "▾";
        rows.push({ label: `${chevron} {bold}USER SKILLS{/bold}  {gray-fg}${total}{/}`, type: "top_header", collapseKey: key, sourcePath: null, skillPath: null, sourcePathForSkill: null });
        if (!collapsed.has(key)) {
          for (const src of sources.custom) {
            for (const f of src.files) {
              rows.push({ label: `  ${f.name}`, type: "skill_entry", collapseKey: key, sourcePath: null, skillPath: f.path, sourcePathForSkill: src.path });
            }
          }
        }
      }
    }

    // ── COMMANDS: flat individual command entries ────────────────────────────
    {
      const key = "commands";
      const total = sources.commands.reduce((n, c) => n + c.count, 0);
      if (total > 0) {
        const chevron = collapsed.has(key) ? "▸" : "▾";
        rows.push({ label: `${chevron} {bold}COMMANDS{/bold}  {gray-fg}${total}{/}`, type: "top_header", collapseKey: key, sourcePath: null, skillPath: null, sourcePathForSkill: null });
        if (!collapsed.has(key)) {
          for (const src of sources.commands) {
            for (const f of src.files) {
              rows.push({ label: `  ${f.name}`, type: "skill_entry", collapseKey: key, sourcePath: null, skillPath: f.path, sourcePathForSkill: src.path });
            }
          }
        }
      }
    }

    // ── PROJECTS: source-level entries (skills browsed via pane 2) ───────────
    {
      const key = "projects";
      const chevron = collapsed.has(key) ? "▸" : "▾";
      const total = sources.projects.reduce((n, p) => n + p.skillCount + p.commandCount, 0);
      rows.push({ label: `${chevron} {bold}PROJECTS{/bold}  {gray-fg}${total}{/}`, type: "top_header", collapseKey: key, sourcePath: null, skillPath: null, sourcePathForSkill: null });
      if (!collapsed.has(key)) {
        for (const p of sources.projects) {
          const count = p.skillCount + p.commandCount;
          rows.push({ label: `  ${p.name}  {gray-fg}${count}{/}`, type: "source_header", collapseKey: `project:${p.path}`, sourcePath: p.path, skillPath: null, sourcePathForSkill: null });
        }
      }
    }

    return rows;
  }

  let rows: Row[] = [];

  function refresh(): void {
    rows = buildRows();
    list.setItems(rows.map((r) => r.label));
    container.screen.render();
  }

  list.on("select", (_item: unknown, idx: number) => {
    const row = rows[idx];
    if (!row) return;

    if (row.type === "top_header") {
      if (collapsed.has(row.collapseKey)) collapsed.delete(row.collapseKey);
      else collapsed.add(row.collapseKey);
      refresh();
    } else if (row.type === "source_header") {
      // Toggle collapse for plugin subgroups; also populate pane 2
      if (collapsed.has(row.collapseKey)) collapsed.delete(row.collapseKey);
      else collapsed.add(row.collapseKey);
      refresh();
      if (row.sourcePath) selectCb(row.sourcePath);
    } else if (row.type === "skill_entry" && row.skillPath && row.sourcePathForSkill) {
      selectSkillCb(row.skillPath, row.sourcePathForSkill);
    }
  });

  refresh();

  return {
    refresh,
    focus: () => list.focus(),
    setActive,
    onSelect: (cb) => { selectCb = cb; },
    onSelectSkill: (cb) => { selectSkillCb = cb; },
  };
}
