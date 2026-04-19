import blessed from "neo-blessed";

export async function run(): Promise<void> {
  const screen = blessed.screen({
    smartCSR: true,
    title: "Skill Viewer",
    fullUnicode: true,
  });

  blessed.box({
    parent: screen,
    top: "center",
    left: "center",
    width: "shrink",
    height: "shrink",
    content: "Skill Viewer TUI · press q to quit",
    border: { type: "line" },
    padding: { left: 2, right: 2 },
  });

  screen.key(["q", "C-c"], () => {
    screen.destroy();
    process.exit(0);
  });

  screen.render();
}
