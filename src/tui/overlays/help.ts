import blessed from "neo-blessed";

export interface HelpOverlay {
  open(): void;
  close(): void;
}

const KEYBINDINGS = `
  NAVIGATION
  ──────────────────────────────────────
  Tab / Shift+Tab   Cycle focus between panes
  1 / 2 / 3         Jump to Sources / Skills / Detail
  ↑ / ↓             Move selection
  Enter             Select / collapse group

  FILTERING
  ──────────────────────────────────────
  /                 Open inline text filter (Skills pane)
  Esc               Clear filter / close overlay
  f                 Toggle tag filter row (Skills pane)
  1-9               Select tag N from tag row

  SEARCH & NAVIGATION
  ──────────────────────────────────────
  Ctrl+P            Open global search overlay
  a                 Open agent switcher

  DETAIL PANE
  ──────────────────────────────────────
  ↑ / ↓             Scroll content

  GENERAL
  ──────────────────────────────────────
  ?                 Show this help
  q / Ctrl+C        Quit
`.trim();

export function createHelpOverlay(screen: blessed.Widgets.Screen): HelpOverlay {
  const lines = KEYBINDINGS.split("\n");
  const height = Math.min(lines.length + 4, 30);

  const box = blessed.box({
    parent: screen,
    top: "center",
    left: "center",
    width: 60,
    height,
    border: { type: "line" },
    label: " Keybindings — press any key to close ",
    style: { border: { fg: "cyan" } },
    hidden: true,
    keys: true,
    tags: true,
    content: KEYBINDINGS,
    padding: { left: 1, right: 1 },
  });

  box.key(/.*/u, () => close());

  function open(): void {
    box.show();
    box.focus();
    screen.render();
  }

  function close(): void {
    box.hide();
    screen.render();
  }

  return { open, close };
}
