import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CallGraph } from "../types/call-graph.js";
import type { DependencyGraph } from "../types/dependency-graph.js";
import type { ProjectIndex } from "../types/project-index.js";
import type { SymbolIndex } from "../types/symbol-index.js";

export interface ProjectKgStore {
  projectIndex: ProjectIndex;
  dependencyGraph: DependencyGraph;
  symbolIndex: SymbolIndex;
  callGraph: CallGraph;
}

export function getIndexDirectory(projectPath: string): string {
  return path.join(path.resolve(projectPath), ".project-kg");
}

export async function writeProjectKgStore(projectPath: string, store: ProjectKgStore): Promise<string> {
  const indexPath = getIndexDirectory(projectPath);
  await mkdir(indexPath, { recursive: true });
  await writeJson(path.join(indexPath, "project-index.json"), store.projectIndex);
  await writeJson(path.join(indexPath, "dependency-graph.json"), store.dependencyGraph);
  await writeJson(path.join(indexPath, "symbol-index.json"), store.symbolIndex);
  await writeJson(path.join(indexPath, "call-graph.json"), store.callGraph);
  return indexPath;
}

export async function readProjectKgStore(projectPath: string): Promise<ProjectKgStore> {
  const indexPath = getIndexDirectory(projectPath);
  return {
    projectIndex: await readJson(path.join(indexPath, "project-index.json")),
    dependencyGraph: await readJson(path.join(indexPath, "dependency-graph.json")),
    symbolIndex: await readJson(path.join(indexPath, "symbol-index.json")),
    callGraph: await readJson(path.join(indexPath, "call-graph.json"))
  };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}
