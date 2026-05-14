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
      const resolved = resolvePythonImport(parsedFile.filePath, importInfo, filePathSet, projectIndex.packages);
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
  filePathSet: Set<string>,
  packages: string[]
): { id: string; kind: "file" | "external"; confidence: "high" | "medium" | "low" } {
  const candidates = buildImportCandidates(fromFile, importInfo, packages);
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

function buildImportCandidates(fromFile: string, importInfo: PythonImportInfo, packages: string[]): string[] {
  const moduleName = importInfo.module;
  const normalizedModule = moduleName.replace(/^\.+/, "").replaceAll(".", "/");
  const baseCandidates = expandModuleCandidates(normalizedModule, importInfo);
  if (!moduleName.startsWith(".")) {
    return unique([...baseCandidates, ...buildPackagePathCandidates(baseCandidates, normalizedModule, packages)]);
  }

  const dotCount = moduleName.match(/^\.+/)?.[0].length ?? 0;
  let directory = path.posix.dirname(fromFile);
  for (let index = 1; index < dotCount; index += 1) {
    directory = path.posix.dirname(directory);
  }

  return unique(baseCandidates.map((candidate) => path.posix.join(directory, candidate)));
}

function expandModuleCandidates(normalizedModule: string, importInfo: PythonImportInfo): string[] {
  const candidates = [`${normalizedModule}.py`, `${normalizedModule}/__init__.py`];
  if (importInfo.isFromImport) {
    for (const importedName of importInfo.imported) {
      if (importedName === "*") {
        continue;
      }

      const normalizedImportedName = importedName.replaceAll(".", "/");
      const snakeImportedName = toSnakeCase(normalizedImportedName);
      candidates.unshift(`${normalizedModule}/${normalizedImportedName}.py`);
      candidates.unshift(`${normalizedModule}/${normalizedImportedName}/__init__.py`);
      if (snakeImportedName !== normalizedImportedName) {
        candidates.unshift(`${normalizedModule}/${snakeImportedName}.py`);
        candidates.unshift(`${normalizedModule}/${snakeImportedName}/__init__.py`);
      }
    }
  }

  return unique(candidates.filter((candidate) => !candidate.startsWith(".py") && !candidate.startsWith("/")));
}

function buildPackagePathCandidates(baseCandidates: string[], normalizedModule: string, packages: string[]): string[] {
  const candidates: string[] = [];
  for (const packagePath of packages) {
    const packageName = path.posix.basename(packagePath);
    if (normalizedModule !== packageName && !normalizedModule.startsWith(`${packageName}/`)) {
      continue;
    }

    const parentPath = path.posix.dirname(packagePath);
    const prefix = parentPath === "." ? "" : parentPath;
    for (const candidate of baseCandidates) {
      candidates.push(prefix ? path.posix.join(prefix, candidate) : candidate);
    }
  }

  return candidates;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function toSnakeCase(value: string): string {
  return value
    .replaceAll(".", "/")
    .split("/")
    .map((part) => part.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase())
    .join("/");
}
