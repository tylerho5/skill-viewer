import blessed from "neo-blessed";
import type { SkillIndex } from "../../index.js";
import { getSources } from "../../index.js";

export interface SourcesPaneHandle {
  refresh(): void;
  focus(): void;
  onSelect(cb: (sourcePath: string) => void): void;
}

interface Row {
  label: string;
  sourcePath: string | null;
  groupKey: string;
  isHeader: boolean;
}

export function createSourcesPane(
  container: blessed.Widgets.BoxElement,
  index: SkillIndex,
): SourcesPaneHandle {
  const collapsed = new Set<string>();
  let selectCb: (p: string) => void = () => {};

  const list = blessed.list({
    parent: container,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    keys: true,
    mouse: true,
    style: {
      selected: { bg: "blue", fg: "white" },
      item: { fg: "white" },
    },
    tags: true,
  });

  function buildRows(): Row[] {
    const sources = getSources(index);
    const rows: Row[] = [];

    const addGroup = (key: string, title: string, entries: { name: string; path: string; count?: number }[]): void => {
      if (entries.length === 0 && key !== "projects") return;
      const chevron = collapsed.has(key) ? "▸" : "▾";
      const total = entries.reduce((n, e) => n + (e.count ?? 0), 0);
      rows.push({ label: `${chevron} {bold}${title}{/bold}  ${total}`, sourcePath: null, groupKey: key, isHeader: true });
      if (collapsed.has(key)) return;
      for (const e of entries) {
        const count = e.count != null ? `  {gray-fg}${e.count}{/gray-fg}` : "";
        rows.push({ label: `  ${e.name}${count}`, sourcePath: e.path, groupKey: key, isHeader: false });
      }
    };

    addGroup("plugins", "PLUGINS", sources.plugins);
    addGroup("custom", "USER SKILLS", sources.custom);
    addGroup("commands", "COMMANDS", sources.commands);
    addGroup("projects", "PROJECTS", sources.projects.map((p) => ({ name: p.name, path: p.path, count: p.skillCount + p.commandCount })));

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
    if (row.isHeader) {
      if (collapsed.has(row.groupKey)) collapsed.delete(row.groupKey);
      else collapsed.add(row.groupKey);
      refresh();
    } else if (row.sourcePath) {
      selectCb(row.sourcePath);
    }
  });

  refresh();

  return {
    refresh,
    focus: () => list.focus(),
    onSelect: (cb) => { selectCb = cb; },
  };
}
