import path from "node:path";
import type { DependencyEdge, DependencyGraph, DependencyNode } from "../types/dependency-graph.js";
import type { ParsedPythonFile, PythonImportInfo } from "./python-parser.js";
import type { ProjectIndex } from "../types/project-index.js";

export function buildDependencyGraph(projectIndex: ProjectIndex, parsedFiles: ParsedPythonFile[]): DependencyGraph {
  const filePathSet = new Set(projectIndex.files.filter((file) => file.path.endsWith(".py")).map((file) => file.path));
  const nodes: DependencyNode[] = [...filePathSet].map((filePath) => ({
    id: filePath,
    path: filePath,
    kind: "file",
    label: path.basename(filePath)
  }));

  const externalNodes = new Map<string, DependencyNode>();
  const edges: DependencyEdge[] = [];

  for (const parsedFile of parsedFiles) {
    for (const importInfo of parsedFile.imports) {
      const resolved = resolvePythonImport(parsedFile.filePath, importInfo, filePathSet);
      if (resolved.kind === "external" && !externalNodes.has(resolved.id)) {
        externalNodes.set(resolved.id, {
          id: resolved.id,
          path: resolved.id,
          kind: "external",
          label: importInfo.module
        });
      }

      edges.push({
        from: parsedFile.filePath,
        to: resolved.id,
        type: "imports",
        imported: importInfo.imported,
        rawModule: importInfo.module,
        confidence: resolved.confidence
      });
    }
  }

  return {
    schemaVersion: 1,
    nodes: [...nodes, ...externalNodes.values()],
    edges
  };
}

function resolvePythonImport(
  fromFile: string,
  importInfo: PythonImportInfo,
  filePathSet: Set<string>
): { id: string; kind: "file" | "external"; confidence: "high" | "medium" | "low" } {
  const candidates = buildImportCandidates(fromFile, importInfo.module);
  for (const candidate of candidates) {
    if (filePathSet.has(candidate)) {
      return { id: candidate, kind: "file", confidence: "high" };
    }
  }

  return {
    id: `external:${importInfo.module}`,
    kind: "external",
    confidence: "low"
  };
}

function buildImportCandidates(fromFile: string, moduleName: string): string[] {
  const normalizedModule = moduleName.replace(/^\.+/, "").replaceAll(".", "/");
  const baseCandidates = [`${normalizedModule}.py`, `${normalizedModule}/__init__.py`];
  if (!moduleName.startsWith(".")) {
    return baseCandidates;
  }

  const dotCount = moduleName.match(/^\.+/)?.[0].length ?? 0;
  let directory = path.posix.dirname(fromFile);
  for (let index = 1; index < dotCount; index += 1) {
    directory = path.posix.dirname(directory);
  }

  return baseCandidates.map((candidate) => path.posix.join(directory, candidate));
}
