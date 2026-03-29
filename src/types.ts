export interface IndexedSkill {
  name: string;
  description: string;
  path: string;
  sourceType: "plugin" | "custom" | "command" | "project";
  sourceName: string;
  filename: string;
  content: string;
  frontmatter: Record<string, string>;
  frontmatterRaw: string;
  crossReferences: string[];
  toolReferences: string[];
  structuralTags: string[];
  wordCount: number;
  mtime: number;
  skillDir: string;
}

export interface SkillSummary {
  name: string;
  description: string;
  path: string;
  filename: string;
  skillDir?: string;
  old?: boolean;
  health?: HealthInfo;
  toolReferences?: string[];
  structuralTags?: string[];
}

export interface HealthInfo {
  mtime: number;
  mtimeIso: string;
  ageDays: number;
  wordCount: number;
  completenessGaps: string[];
  toolCount: number;
  crossRefCount: number;
  structuralTags: string[];
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  name: string;
  sourceType: string;
  sourceName: string;
  wordCount: number;
  structuralTags: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface SearchResult {
  name: string;
  description: string;
  path: string;
  sourceType: string;
  sourceName: string;
  snippet: string;
  structuralTags: string[];
}

export interface TreeEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  extension?: string;
  children?: TreeEntry[];
}

export interface ProjectSource {
  name: string;
  path: string;
  projectDir: string;
  commandCount: number;
  skillCount: number;
}

export interface SourceInfo {
  plugins: PluginSource[];
  custom: CustomSource[];
  commands: CommandSource[];
  projects: ProjectSource[];
}

export interface PluginSource {
  name: string;
  path: string;
  count: number;
  version: string;
  skills: { name: string; path: string }[];
}

export interface CustomSource {
  name: string;
  path: string;
  count: number;
  files: { name: string; path: string }[];
}

export interface CommandSource {
  name: string;
  path: string;
  count: number;
  files: { name: string; path: string }[];
}

export interface AgentConfig {
  id: string;
  name: string;
  globalDir: string;
  projectDirName: string;
  fileExtensions: string[];
  hasPlugins: boolean;
  subdirs: string[];
  scanGlobalRoot: boolean;
}
