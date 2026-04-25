import os from "node:os";
import type { SkillIndex } from "../index.js";
import type { AgentConfig } from "../types.js";

export type FocusedPane = "sources" | "list" | "detail";

export interface ViewState {
  focus: FocusedPane;
  selectedSourcePath: string | null;
  selectedSkillPath: string | null;
  listFilter: string;
  tagFilter: string | null;
  showTagRow: boolean;
  overlayOpen: "globalSearch" | "agentSwitcher" | "help" | null;
}

export function initialState(): ViewState {
  return {
    focus: "sources",
    selectedSourcePath: null,
    selectedSkillPath: null,
    listFilter: "",
    tagFilter: null,
    showTagRow: false,
    overlayOpen: null,
  };
}

export function formatTopBar(index: SkillIndex, agent: AgentConfig): string {
  const dir = agent.globalDir.replace(os.homedir(), "~");
  return ` Skill Viewer   ${agent.name}   ${index.skills.length} skills   ${dir} `;
}
