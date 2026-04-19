import blessed from "neo-blessed";
import type { SkillIndex } from "../../index.js";
import type { SearchResult } from "../../types.js";

export interface GlobalSearchOverlay {
  open(): void;
  close(): void;
}

export function createGlobalSearchOverlay(
  screen: blessed.Widgets.Screen,
  index: SkillIndex,
  onNavigate: (skillPath: string) => void,
): GlobalSearchOverlay {
  let results: SearchResult[] = [];

  const box = blessed.box({
    parent: screen,
    top: "center",
    left: "center",
    width: "80%",
    height: "80%",
    border: { type: "line" },
    label: " Search (Esc to close) ",
    style: { border: { fg: "cyan" } },
    hidden: true,
    tags: true,
  });

  const input = blessed.textbox({
    parent: box,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    style: { bg: "black", fg: "white" },
    inputOnFocus: true,
  });

  const resultList = blessed.list({
    parent: box,
    top: 2,
    left: 0,
    right: 0,
    bottom: 0,
    keys: true,
    mouse: true,
    scrollable: true,
    tags: true,
    style: { selected: { bg: "blue", fg: "white" } },
  });

  function runSearch(query: string): void {
    results = index.search(query);
    const items = results.map(
      (r) => `{bold}${r.name}{/bold}  {gray-fg}· ${r.sourceName} · ${r.snippet.slice(0, 60).replace(/\n/g, " ")}{/}`,
    );
    resultList.setItems(items.length ? items : ["{gray-fg}(no results){/}"]);
    screen.render();
  }

  input.on("keypress", (_ch: string, key: { name: string }) => {
    if (key.name === "escape") {
      close();
      return;
    }
    if (key.name === "down") {
      resultList.focus();
      return;
    }
    setImmediate(() => {
      runSearch(input.getValue());
    });
  });

  resultList.key(["escape"], () => close());
  resultList.key(["up"], () => {
    if ((resultList.selected as number) === 0) input.focus();
  });

  resultList.on("select", (_item: unknown, idx: number) => {
    const r = results[idx];
    if (r) {
      close();
      onNavigate(r.path);
    }
  });

  function open(): void {
    box.show();
    input.setValue("");
    results = [];
    resultList.setItems(["{gray-fg}(type to search){/}"]);
    input.focus();
    screen.render();
  }

  function close(): void {
    box.hide();
    screen.render();
  }

  return { open, close };
}
