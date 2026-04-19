import { SkillIndex } from "../index.js";
import { setupWatcher } from "../watcher.js";
import { createScreen } from "./screen.js";
import { formatTopBar, initialState } from "./state.js";

export async function run(): Promise<void> {
  const index = new SkillIndex();
  index.build();

  const panes = createScreen();
  const state = initialState();

  panes.topBar.setContent(formatTopBar(index, index.getActiveAgent()));
  panes.screen.render();

  let repaintTimer: NodeJS.Timeout | null = null;
  const requestRepaint = (): void => {
    if (repaintTimer) return;
    repaintTimer = setTimeout(() => {
      repaintTimer = null;
      index.build();
      panes.topBar.setContent(formatTopBar(index, index.getActiveAgent()));
      panes.screen.render();
    }, 150);
  };

  const broadcast = (_msg: unknown): void => requestRepaint();
  const watcher = setupWatcher(index, broadcast as (msg: Record<string, unknown>) => void);

  const originalSetAgent = index.setAgent.bind(index);
  index.setAgent = (agentId: string): void => {
    originalSetAgent(agentId);
    watcher.switchAgent();
  };

  panes.screen.key(["q", "C-c"], async () => {
    panes.screen.destroy();
    await watcher.close();
    process.exit(0);
  });

  panes.screen.render();
}
