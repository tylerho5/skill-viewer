import blessed from "neo-blessed";
import { getSkillsForSource } from "../../index.js";
import type { SkillIndex } from "../../index.js";
import type { SkillSummary } from "../../types.js";
import { renderBadgeRow, truncate } from "../render/badges.js";

const ROW_SIZE = 2; // name row + desc row per skill, no blank line

export interface SkillsListHandle {
  setSource(sourcePath: string | null): void;
  setFilter(text: string): void;
  refresh(): void;
  focus(): void;
  onSelect(cb: (skillPath: string) => void): void;
  showFilter(): void;
  hideFilter(): void;
  toggleTagRow(): void;
}

export function createSkillsListPane(
  container: blessed.Widgets.BoxElement,
  index: SkillIndex,
): SkillsListHandle {
  let sourcePath: string | null = null;
  let filter = "";
  let tagFilter: string | null = null;
  let tagRowVisible = false;
  let skills: SkillSummary[] = [];
  let topTags: { tag: string; count: number }[] = [];
  let currentSkillIdx = 0;
  let cb: (p: string) => void = () => {};

  const tagRow = blessed.box({
    parent: container,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    hidden: true,
    tags: true,
    style: { bg: "black", fg: "white" },
  });

  const filterBox = blessed.textbox({
    parent: container,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    hidden: true,
    style: { bg: "black", fg: "white" },
    inputOnFocus: true,
  });

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

  function listTop(): number {
    return (tagRowVisible ? 1 : 0) + (!filterBox.hidden ? 1 : 0);
  }

  function computeTagRow(): void {
    const freq = new Map<string, number>();
    for (const s of skills) {
      for (const t of [...(s.structuralTags ?? []), ...(s.toolReferences ?? [])]) {
        freq.set(t, (freq.get(t) ?? 0) + 1);
      }
    }
    topTags = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    const content = topTags
      .map((t, i) => `[{bold}${i + 1}{/bold} ${t.tag} (${t.count})]`)
      .join(" ");
    tagRow.setContent(content || "{gray-fg}(no tags){/}");
  }

  function refresh(): void {
    if (!sourcePath) {
      skills = [];
      list.setItems(["{gray-fg}(select a source){/}"]);
    } else {
      const all = getSkillsForSource(sourcePath, index);
      const q = filter.toLowerCase();
      const filtered = q
        ? all.filter((s) => `${s.name} ${s.description}`.toLowerCase().includes(q))
        : all;
      skills = tagFilter
        ? filtered.filter((s) =>
            (s.structuralTags ?? []).includes(tagFilter!) ||
            (s.toolReferences ?? []).includes(tagFilter!)
          )
        : filtered;

      // Compute how much space to give description after reserving for badge text
      const paneWidth = Math.max(20, (container.width as number) - 4);
      const items: string[] = [];
      for (const s of skills) {
        items.push(`{bold}▸ ${s.name}{/bold}`);
        const badges = renderBadgeRow(s);
        // Leave room for " · badges" if badges exist, otherwise full width for desc
        const badgePlain = badges.replace(/\{[^}]+\}/g, ""); // strip tags for length
        const descWidth = badges ? paneWidth - badgePlain.length - 3 : paneWidth;
        const desc = truncate(s.description || "", Math.max(10, descWidth));
        items.push(`  {gray-fg}${desc}{/}${badges ? " · " + badges : ""}`);
      }
      list.setItems(items.length ? items : ["{gray-fg}(no skills){/}"]);
    }

    // Restore selection on the correct name row after refresh
    currentSkillIdx = Math.min(currentSkillIdx, Math.max(0, skills.length - 1));
    if (skills.length > 0) list.select(currentSkillIdx * ROW_SIZE);

    if (tagRowVisible) computeTagRow();
    list.top = listTop();
    container.screen.render();
  }

  // Intercept up/down to skip by skill, not by row
  list.on("keypress", (_ch: string, key: { name: string }) => {
    if (key.name !== "up" && key.name !== "down") return;
    setImmediate(() => {
      if (key.name === "down") {
        currentSkillIdx = Math.min(skills.length - 1, currentSkillIdx + 1);
      } else {
        currentSkillIdx = Math.max(0, currentSkillIdx - 1);
      }
      if (skills.length > 0) list.select(currentSkillIdx * ROW_SIZE);
      container.screen.render();
    });
  });

  // Enter on any row of a skill fires the callback
  list.on("select", (_item: unknown, idx: number) => {
    const skillIdx = Math.floor(idx / ROW_SIZE);
    const s = skills[skillIdx];
    if (s) {
      currentSkillIdx = skillIdx;
      cb(s.path);
    }
  });

  filterBox.on("keypress", (_ch: string, key: { name: string }) => {
    if (key.name === "escape") {
      hideFilter();
      return;
    }
    setImmediate(() => {
      filter = filterBox.getValue();
      refresh();
    });
  });

  function showFilter(): void {
    filterBox.show();
    filterBox.top = tagRowVisible ? 1 : 0;
    filterBox.setValue("/ ");
    filterBox.focus();
    filter = "";
    refresh();
    container.screen.render();
  }

  function hideFilter(): void {
    filterBox.hide();
    filter = "";
    refresh();
    list.focus();
  }

  function toggleTagRow(): void {
    tagRowVisible = !tagRowVisible;
    if (tagRowVisible) {
      tagRow.show();
      tagRow.top = 0;
      filterBox.top = 1;
      computeTagRow();
    } else {
      tagRow.hide();
      tagFilter = null;
      filterBox.top = 0;
    }
    refresh();
  }

  container.screen.key(["1", "2", "3", "4", "5", "6", "7", "8", "9"], (_ch: string, key: { name: string }) => {
    if (!tagRowVisible) return;
    const n = parseInt(key.name, 10) - 1;
    const entry = topTags[n];
    if (!entry) return;
    tagFilter = tagFilter === entry.tag ? null : entry.tag;
    refresh();
  });

  return {
    setSource(p) { sourcePath = p; filter = ""; tagFilter = null; currentSkillIdx = 0; refresh(); },
    setFilter(f) { filter = f; refresh(); },
    refresh,
    focus: () => list.focus(),
    onSelect: (c) => { cb = c; },
    showFilter,
    hideFilter,
    toggleTagRow,
  };
}
