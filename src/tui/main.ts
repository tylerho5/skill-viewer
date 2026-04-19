import { SkillIndex, getSources } from "../index.js";
import { setupWatcher } from "../watcher.js";
import { createScreen, setActivePane } from "./screen.js";
import { formatTopBar, initialState } from "./state.js";
import { createSourcesPane } from "./panes/sources.js";
import { createSkillsListPane } from "./panes/skillsList.js";
import { createDetailPane } from "./panes/detail.js";
import { createGlobalSearchOverlay } from "./overlays/globalSearch.js";
import type { FocusedPane } from "./state.js";

export async function run(): Promise<void> {
  const index = new SkillIndex();
  index.build();

  const panes = createScreen();
  const state = initialState();

  panes.topBar.setContent(formatTopBar(index, index.getActiveAgent()));
  panes.screen.render();

  const sourcesPane = createSourcesPane(panes.sources, index);
  const skillsPane = createSkillsListPane(panes.list, index);
  const detailPane = createDetailPane(panes.detail, index);

  const order: FocusedPane[] = ["sources", "list", "detail"];

  function setFocus(name: FocusedPane): void {
    state.focus = name;
    if (name === "sources") sourcesPane.focus();
    else if (name === "list") skillsPane.focus();
    else detailPane.focus();
    setActivePane(panes, name);
    panes.screen.render();
  }

  function navigateToSkill(skillPath: string): void {
    const skill = index.get(skillPath);
    if (!skill) return;

    const sources = getSources(index);
    let foundSourcePath: string | null = null;

    if (skill.sourceType === "plugin") {
      foundSourcePath = sources.plugins.find((p) => p.name === skill.sourceName)?.path ?? null;
    } else if (skill.sourceType === "custom") {
      foundSourcePath = sources.custom[0]?.path ?? null;
    } else if (skill.sourceType === "command") {
      foundSourcePath = sources.commands[0]?.path ?? null;
    } else if (skill.sourceType === "project") {
      foundSourcePath = sources.projects.find((p) => p.name === skill.sourceName)?.path ?? null;
    }

    if (foundSourcePath) {
      state.selectedSourcePath = foundSourcePath;
      skillsPane.setSource(foundSourcePath);
    }
    state.selectedSkillPath = skillPath;
    detailPane.show(skillPath);
    setFocus("detail");
  }

  const searchOverlay = createGlobalSearchOverlay(panes.screen, index, navigateToSkill);

  sourcesPane.onSelect((sourcePath) => {
    state.selectedSourcePath = sourcePath;
    skillsPane.setSource(sourcePath);
  });
  skillsPane.onSelect((skillPath) => {
    state.selectedSkillPath = skillPath;
    detailPane.show(skillPath);
  });
  setFocus("sources");

  let repaintTimer: NodeJS.Timeout | null = null;
  const requestRepaint = (): void => {
    if (repaintTimer) return;
    repaintTimer = setTimeout(() => {
      repaintTimer = null;
      index.build();
      panes.topBar.setContent(formatTopBar(index, index.getActiveAgent()));
      sourcesPane.refresh();
      skillsPane.refresh();
      detailPane.refresh();
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

  panes.screen.key(["/"], () => {
    if (state.focus !== "list") setFocus("list");
    skillsPane.showFilter();
  });

  panes.screen.key(["f"], () => {
    if (state.focus === "list") skillsPane.toggleTagRow();
  });

  panes.screen.key(["C-p"], () => searchOverlay.open());

  panes.screen.key(["tab"], () => {
    const i = order.indexOf(state.focus);
    setFocus(order[(i + 1) % order.length]);
  });
  panes.screen.key(["S-tab"], () => {
    const i = order.indexOf(state.focus);
    setFocus(order[(i - 1 + order.length) % order.length]);
  });
  panes.screen.key(["1"], () => setFocus("sources"));
  panes.screen.key(["2"], () => setFocus("list"));
  panes.screen.key(["3"], () => setFocus("detail"));

  panes.screen.key(["q", "C-c"], async () => {
    panes.screen.destroy();
    await watcher.close();
    process.exit(0);
  });

  panes.screen.render();
}
