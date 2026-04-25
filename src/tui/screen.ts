import blessed from "neo-blessed";

export interface Panes {
  screen: blessed.Widgets.Screen;
  topBar: blessed.Widgets.BoxElement;
  sources: blessed.Widgets.BoxElement;
  list: blessed.Widgets.BoxElement;
  detail: blessed.Widgets.BoxElement;
  bottomBar: blessed.Widgets.BoxElement;
}

const LEFT_W = 22;
const MID_W = 32;

export function createScreen(): Panes {
  const screen = blessed.screen({
    smartCSR: true,
    title: "Skill Viewer",
    fullUnicode: true,
  });

  const topBar = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    content: " Skill Viewer ",
    style: { bg: "black", fg: "cyan", bold: true },
  });

  const sources = blessed.box({
    parent: screen,
    label: " [1] Sources ",
    top: 1,
    left: 0,
    width: LEFT_W,
    bottom: 1,
    border: { type: "line" },
    style: { border: { fg: "gray" } },
    content: "(sources)",
  });

  const list = blessed.box({
    parent: screen,
    label: " [2] Skills ",
    top: 1,
    left: LEFT_W,
    width: MID_W,
    bottom: 1,
    border: { type: "line" },
    style: { border: { fg: "gray" } },
    content: "(list)",
  });

  const detail = blessed.box({
    parent: screen,
    label: " [3] Detail ",
    top: 1,
    left: LEFT_W + MID_W,
    right: 0,
    bottom: 1,
    border: { type: "line" },
    style: { border: { fg: "gray" } },
    content: "(detail)",
  });

  const bottomBar = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    content: " ↑↓ move   Tab pane   Enter open   / filter   ^P search   a agent   ? help   q quit ",
    style: { bg: "black", fg: "white" },
  });

  const tooNarrow = blessed.box({
    parent: screen,
    top: "center",
    left: "center",
    width: "shrink",
    height: "shrink",
    content: " Terminal too narrow — please resize to at least 60 columns ",
    hidden: true,
    style: { fg: "yellow" },
  });

  function applyLayout(): void {
    const w = screen.width as number;
    if (w < 60) {
      sources.hide();
      list.hide();
      detail.hide();
      tooNarrow.show();
      return;
    }
    tooNarrow.hide();
    if (w < 100) {
      sources.hide();
      list.show();
      list.left = 0 as unknown as string;
      list.width = Math.floor(w * 0.3) as unknown as string;
      detail.show();
      detail.left = Math.floor(w * 0.3) as unknown as string;
      detail.right = 0 as unknown as string;
    } else {
      sources.show();
      list.left = LEFT_W as unknown as string;
      list.width = MID_W as unknown as string;
      detail.left = (LEFT_W + MID_W) as unknown as string;
      detail.right = 0 as unknown as string;
    }
  }

  screen.on("resize", () => { applyLayout(); screen.render(); });

  return { screen, topBar, sources, list, detail, bottomBar };
}

export type FocusTarget = "sources" | "list" | "detail";

export function setActivePane(panes: Panes, focused: FocusTarget): void {
  const map: Record<FocusTarget, blessed.Widgets.BoxElement> = {
    sources: panes.sources,
    list: panes.list,
    detail: panes.detail,
  };
  for (const [key, box] of Object.entries(map) as [FocusTarget, blessed.Widgets.BoxElement][]) {
    (box.style as { border: { fg: string } }).border.fg = key === focused ? "cyan" : "gray";
  }
}
