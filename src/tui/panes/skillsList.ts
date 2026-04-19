import blessed from "neo-blessed";
import { getSkillsForSource } from "../../index.js";
import type { SkillIndex } from "../../index.js";
import type { SkillSummary } from "../../types.js";
import { renderBadgeRow, truncate } from "../render/badges.js";

export interface SkillsListHandle {
  setSource(sourcePath: string | null): void;
  setFilter(text: string): void;
  refresh(): void;
  focus(): void;
  onSelect(cb: (skillPath: string) => void): void;
}

export function createSkillsListPane(
  container: blessed.Widgets.BoxElement,
  index: SkillIndex,
): SkillsListHandle {
  let sourcePath: string | null = null;
  let filter = "";
  let skills: SkillSummary[] = [];
  let cb: (p: string) => void = () => {};

  const list = blessed.list({
    parent: container,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    keys: true,
    mouse: true,
    scrollable: true,
    tags: true,
    style: { selected: { bg: "blue", fg: "white" } },
  });

  function refresh(): void {
    if (!sourcePath) {
      skills = [];
      list.setItems(["{gray-fg}(select a source){/}"]);
    } else {
      const all = getSkillsForSource(sourcePath, index);
      const q = filter.toLowerCase();
      skills = q
        ? all.filter((s) => `${s.name} ${s.description}`.toLowerCase().includes(q))
        : all;
      const width = Math.max(20, (container.width as number) - 4);
      const items: string[] = [];
      for (const s of skills) {
        items.push(`{bold}▸ ${s.name}{/bold}`);
        const desc = truncate(s.description || "", width - 4);
        const badges = renderBadgeRow(s);
        items.push(`  ${desc}${badges ? " · " + badges : ""}`);
        items.push("");
      }
      list.setItems(items.length ? items : ["{gray-fg}(no skills){/}"]);
    }
    container.screen.render();
  }

  list.on("select", (_item: unknown, idx: number) => {
    const skillIdx = Math.floor(idx / 3);
    const s = skills[skillIdx];
    if (s) cb(s.path);
  });

  return {
    setSource(p) { sourcePath = p; filter = ""; refresh(); },
    setFilter(f) { filter = f; refresh(); },
    refresh,
    focus: () => list.focus(),
    onSelect: (c) => { cb = c; },
  };
}
