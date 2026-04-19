import blessed from "neo-blessed";
import type { SkillIndex } from "../../index.js";
import { escapeBlessed } from "../render/markdown.js";

export interface DetailPaneHandle {
  show(skillPath: string | null): void;
  focus(): void;
  refresh(): void;
  setActive(active: boolean): void;
}

export function createDetailPane(
  container: blessed.Widgets.BoxElement,
  index: SkillIndex,
): DetailPaneHandle {
  let currentPath: string | null = null;

  const body = blessed.box({
    parent: container,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    keys: true,
    mouse: true,
    scrollable: true,
    scrollbar: { ch: " ", style: { bg: "gray" } },
    tags: true,
    padding: { left: 1, right: 1 },
    style: { fg: "white" },
  });

  function setActive(active: boolean): void {
    (body.style as { fg: string }).fg = active ? "white" : "gray";
    container.screen.render();
  }

  // neo-blessed default wheel scroll is height/2 lines — override to 3 lines.
  body.removeAllListeners("wheeldown");
  body.removeAllListeners("wheelup");
  body.on("wheeldown", () => { (body as blessed.Widgets.ScrollableBoxElement).scroll(3); container.screen.render(); });
  body.on("wheelup", () => { (body as blessed.Widgets.ScrollableBoxElement).scroll(-3); container.screen.render(); });

  function render(): void {
    if (!currentPath) {
      body.setContent("{gray-fg}(select a skill){/}");
      container.screen.render();
      return;
    }
    const skill = index.get(currentPath);
    if (!skill) {
      body.setContent("{red-fg}Skill not found{/}");
      container.screen.render();
      return;
    }

    const width = Math.max(20, (container.width as number) - 4);
    const dividerWidth = Math.min(width, 60);
    const divider = `{gray-fg}${"─".repeat(dividerWidth)}{/}`;

    const lines: string[] = [];
    lines.push(`{bold}${skill.name}{/bold}`);
    if (skill.description) lines.push(skill.description);
    lines.push(`{gray-fg}${skill.path}{/}`);
    lines.push("");
    lines.push("{bold}METADATA{/bold}");
    lines.push(divider);
    for (const [k, v] of Object.entries(skill.frontmatter)) {
      lines.push(`  {cyan-fg}${k}{/}  ${String(v)}`);
    }
    lines.push("");
    lines.push("{bold}CONTENT{/bold}");
    lines.push(divider);
    lines.push("");
    lines.push(escapeBlessed(skill.content));

    body.setContent(lines.join("\n"));
    body.setScrollPerc(0);
    container.screen.render();
  }

  return {
    show(path) { currentPath = path; render(); },
    focus: () => body.focus(),
    refresh: render,
    setActive,
  };
}
