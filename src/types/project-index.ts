export type ProjectLanguage = "python";

export type SourceFileKind =
  | "source"
  | "test"
  | "entrypoint"
  | "config"
  | "documentation";

export interface SourceFileInfo {
  path: string;
  absolutePath: string;
  kind: SourceFileKind;
  sizeBytes: number;
}

export interface ProjectIndex {
  schemaVersion: 1;
  rootPath: string;
  language: ProjectLanguage;
  generatedAt: string;
  entrypoints: string[];
  packages: string[];
  files: SourceFileInfo[];
}

export interface BuildProjectIndexOptions {
  projectPath: string;
  maxDepth?: number;
  force?: boolean;
}

export interface BuildProjectIndexResult {
  indexPath: string;
  fileCount: number;
  symbolCount: number;
  dependencyCount: number;
  callCount: number;
}
