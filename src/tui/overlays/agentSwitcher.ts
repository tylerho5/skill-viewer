import blessed from "neo-blessed";
import { getAgentConfigs } from "../../index.js";
import type { SkillIndex } from "../../index.js";

export interface AgentSwitcherOverlay {
  open(): void;
  close(): void;
}

export function createAgentSwitcherOverlay(
  screen: blessed.Widgets.Screen,
  index: SkillIndex,
  onSwitch: (agentId: string) => void,
): AgentSwitcherOverlay {
  const agents = getAgentConfigs();

  const box = blessed.box({
    parent: screen,
    top: "center",
    left: "center",
    width: 50,
    height: agents.length + 4,
    border: { type: "line" },
    label: " Switch Agent (Esc to close) ",
    style: { border: { fg: "cyan" } },
    hidden: true,
  });

  const list = blessed.list({
    parent: box,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    keys: true,
    mouse: true,
    tags: true,
    style: { selected: { bg: "cyan", fg: "black", bold: true } },
  });

  function buildItems(): string[] {
    const active = index.getActiveAgent();
    return agents.map((a) => (a.id === active.id ? `* ${a.name}` : `  ${a.name}`));
  }

  list.key(["escape"], () => close());

  list.on("select", (_item: unknown, idx: number) => {
    const agent = agents[idx];
    if (agent) {
      close();
      onSwitch(agent.id);
    }
  });

  function open(): void {
    list.setItems(buildItems());
    const activeIdx = agents.findIndex((a) => a.id === index.getActiveAgent().id);
    if (activeIdx >= 0) list.select(activeIdx);
    box.show();
    list.focus();
    screen.render();
  }

  function close(): void {
    box.hide();
    screen.render();
  }

  return { open, close };
}
