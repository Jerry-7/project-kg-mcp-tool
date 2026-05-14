import path from "node:path";
import type { FeatureTrace, FeatureTraceMatch, FeatureTraceStep } from "../types/call-graph.js";
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
    label: formatModuleLabel(filePath),
    detail: filePath,
    kind: classifyModuleRole(filePath, store.projectIndex.entrypoints),
    group: classifyModuleRole(filePath, store.projectIndex.entrypoints)
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

function formatModuleLabel(filePath: string): string {
  const basename = path.posix.basename(filePath, ".py");
  if (basename === "__init__") {
    return path.posix.basename(path.posix.dirname(filePath));
  }
  return basename;
}

function classifyModuleRole(filePath: string, entrypoints: string[]): string {
  if (entrypoints.includes(filePath)) {
    return "entrypoint";
  }

  const normalizedPath = `/${filePath.toLowerCase()}`;
  if (matchesPathRole(normalizedPath, ["api", "apis", "route", "routes", "view", "views", "controller", "controllers", "endpoint", "endpoints"])) {
    return "interface";
  }
  if (matchesPathRole(normalizedPath, ["service", "services", "usecase", "usecases", "application"])) {
    return "service";
  }
  if (matchesPathRole(normalizedPath, ["domain", "core"])) {
    return "domain";
  }
  if (matchesPathRole(normalizedPath, ["repository", "repositories", "dao", "storage", "database", "db"])) {
    return "repository";
  }
  if (matchesPathRole(normalizedPath, ["model", "models", "schema", "schemas", "entity", "entities"])) {
    return "model";
  }
  if (path.posix.basename(filePath) === "__init__.py") {
    return "package";
  }

  return "module";
}

function matchesPathRole(normalizedPath: string, roleHints: string[]): boolean {
  return roleHints.some((hint) => normalizedPath.includes(`/${hint}/`) || normalizedPath.endsWith(`/${hint}.py`) || normalizedPath.includes(`_${hint}.py`));
}

export function traceFeature(store: ProjectKgStore, query: string, maxDepth = 4): FeatureTrace {
  const matches = findRootSymbolMatches(store.symbolIndex, query);
  const root = matches[0] ? store.symbolIndex.symbols.find((symbol) => symbol.id === matches[0].symbolId) : undefined;
  if (!root) {
    return { query, matches, steps: [], edges: [] };
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
    matches,
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

function findRootSymbolMatches(symbolIndex: SymbolIndex, query: string): FeatureTraceMatch[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  return symbolIndex.symbols
    .map((symbol) => scoreSymbolMatch(symbol, normalizedQuery))
    .filter((match): match is FeatureTraceMatch => Boolean(match))
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, 8);
}

function scoreSymbolMatch(symbol: SymbolNode, normalizedQuery: string): FeatureTraceMatch | undefined {
  const candidates = [
    { value: symbol.id, reason: "symbol id" },
    { value: symbol.qualifiedName, reason: "qualified name" },
    { value: symbol.name, reason: "symbol name" },
    { value: symbol.filePath, reason: "file path" },
    { value: `${symbol.filePath} ${symbol.qualifiedName}`, reason: "file path and qualified name" }
  ].map((candidate) => ({
    normalizedValue: normalizeSearchText(candidate.value),
    reason: candidate.reason
  }));

  let best: { score: number; reason: string } | undefined;
  for (const candidate of candidates) {
    const score = scoreTextMatch(candidate.normalizedValue, normalizedQuery);
    if (score > 0 && (!best || score > best.score)) {
      best = { score, reason: candidate.reason };
    }
  }

  if (!best) {
    return undefined;
  }

  return {
    symbolId: symbol.id,
    label: symbol.qualifiedName,
    kind: symbol.kind,
    filePath: symbol.filePath,
    score: best.score,
    reason: best.reason
  };
}

function scoreTextMatch(value: string, query: string): number {
  if (value === query) {
    return 100;
  }
  if (value.endsWith(` ${query}`) || value.endsWith(`.${query}`) || value.endsWith(`/${query}`)) {
    return 90;
  }
  if (value.includes(query)) {
    return 70;
  }

  const queryTokens = query.split(" ").filter(Boolean);
  if (queryTokens.length > 1 && queryTokens.every((token) => value.includes(token))) {
    return 55;
  }

  return 0;
}

function normalizeSearchText(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_:./\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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
