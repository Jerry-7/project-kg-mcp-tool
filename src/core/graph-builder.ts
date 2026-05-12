import path from "node:path";
import type { FeatureTrace, FeatureTraceStep } from "../types/call-graph.js";
import type { DependencyGraph } from "../types/dependency-graph.js";
import type { DiagramModel } from "../types/drawio.js";
import type { ProjectIndex } from "../types/project-index.js";
import type { SymbolIndex, SymbolNode } from "../types/symbol-index.js";
import type { ProjectKgStore } from "./index-store.js";

const corePathHints = [
  "api",
  "routes",
  "views",
  "controllers",
  "services",
  "service",
  "core",
  "domain",
  "repositories",
  "repository",
  "models",
  "schemas"
];

export function buildCoreModulesDiagram(store: ProjectKgStore): DiagramModel {
  const coreFiles = selectCoreFiles(store.projectIndex, store.dependencyGraph);
  const coreFileSet = new Set(coreFiles);
  const nodes = coreFiles.map((filePath) => ({
    id: filePath,
    label: filePath,
    kind: store.projectIndex.entrypoints.includes(filePath) ? "entrypoint" : "module"
  }));

  const edges = store.dependencyGraph.edges
    .filter((edge) => coreFileSet.has(edge.from) && coreFileSet.has(edge.to))
    .map((edge) => ({
      from: edge.from,
      to: edge.to,
      label: edge.imported.slice(0, 3).join(", ")
    }));

  return {
    title: "Core Python Module Dependencies",
    nodes,
    edges
  };
}

export function traceFeature(store: ProjectKgStore, query: string, maxDepth = 4): FeatureTrace {
  const root = findRootSymbol(store.symbolIndex, query);
  if (!root) {
    return { query, steps: [], edges: [] };
  }

  const steps: FeatureTraceStep[] = [];
  const edges: Array<{ from: string; to: string; label?: string }> = [];
  const visited = new Set<string>();
  const symbolMap = new Map(store.symbolIndex.symbols.map((symbol) => [symbol.id, symbol]));

  function visit(symbol: SymbolNode, depth: number): void {
    if (depth > maxDepth || visited.has(symbol.id)) {
      return;
    }

    visited.add(symbol.id);
    steps.push(symbolToTraceStep(symbol));

    const outgoing = store.callGraph.edges
      .filter((edge) => edge.from === symbol.id && edge.to && symbolMap.has(edge.to))
      .slice(0, 8);

    for (const edge of outgoing) {
      if (!edge.to) {
        continue;
      }
      edges.push({ from: edge.from, to: edge.to, label: edge.calleeName });
      visit(symbolMap.get(edge.to)!, depth + 1);
    }
  }

  visit(root, 0);

  return {
    query,
    rootSymbolId: root.id,
    steps,
    edges
  };
}

export function buildFeatureTraceDiagram(trace: FeatureTrace): DiagramModel {
  return {
    title: `Feature Trace: ${trace.query}`,
    nodes: trace.steps.map((step) => ({
      id: step.symbolId,
      label: step.label,
      detail: step.detail,
      kind: "symbol"
    })),
    edges: trace.edges
  };
}

function selectCoreFiles(projectIndex: ProjectIndex, dependencyGraph: DependencyGraph): string[] {
  const pythonFiles = projectIndex.files.filter((file) => file.path.endsWith(".py") && file.kind !== "test");
  const incomingCounts = new Map<string, number>();
  for (const edge of dependencyGraph.edges) {
    incomingCounts.set(edge.to, (incomingCounts.get(edge.to) ?? 0) + 1);
  }

  return pythonFiles
    .map((file) => ({
      path: file.path,
      score: scoreCoreFile(file.path, projectIndex.entrypoints, incomingCounts.get(file.path) ?? 0)
    }))
    .filter((file) => file.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 40)
    .map((file) => file.path);
}

function scoreCoreFile(filePath: string, entrypoints: string[], incomingCount: number): number {
  let score = incomingCount;
  if (entrypoints.includes(filePath)) {
    score += 10;
  }

  const lowerPath = filePath.toLowerCase();
  if (corePathHints.some((hint) => lowerPath.includes(`/${hint}/`) || lowerPath.includes(`${hint}.py`))) {
    score += 5;
  }

  if (path.posix.basename(filePath) === "__init__.py") {
    score -= 2;
  }

  return score;
}

function findRootSymbol(symbolIndex: SymbolIndex, query: string): SymbolNode | undefined {
  const normalizedQuery = query.toLowerCase();
  return (
    symbolIndex.symbols.find((symbol) => symbol.id.toLowerCase() === normalizedQuery) ??
    symbolIndex.symbols.find((symbol) => symbol.qualifiedName.toLowerCase() === normalizedQuery) ??
    symbolIndex.symbols.find((symbol) => symbol.name.toLowerCase() === normalizedQuery) ??
    symbolIndex.symbols.find((symbol) => symbol.filePath.toLowerCase().includes(normalizedQuery)) ??
    symbolIndex.symbols.find((symbol) => symbol.qualifiedName.toLowerCase().includes(normalizedQuery))
  );
}

function symbolToTraceStep(symbol: SymbolNode): FeatureTraceStep {
  const params = symbol.params.map((param) => param.annotation ? `${param.name}: ${param.annotation}` : param.name);
  const signature = `${symbol.qualifiedName}(${params.join(", ")})${symbol.returnType ? ` -> ${symbol.returnType}` : ""}`;
  return {
    symbolId: symbol.id,
    label: symbol.qualifiedName,
    detail: `${signature}\n${symbol.filePath}:${symbol.location.startLine}`,
    filePath: symbol.filePath
  };
}
