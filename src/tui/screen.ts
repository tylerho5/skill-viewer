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
    style: { bg: "blue", fg: "white" },
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
    content: " Tab switch · ↑↓ move · Enter open · / filter · ^P search · a agent · ? help · q quit ",
    style: { bg: "blue", fg: "white" },
  });

  return { screen, topBar, sources, list, detail, bottomBar };
}
