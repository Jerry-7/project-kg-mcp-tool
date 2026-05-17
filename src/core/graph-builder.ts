import path from "node:path";
import type {
  CallEdge,
  FeatureFlow,
  FeatureFlowEdge,
  FeatureFlowOptions,
  FeatureFlowStep,
  FeatureTrace,
  FeatureTraceMatch,
  FeatureTraceStep
} from "../types/call-graph.js";
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

const defaultFeatureFlowOptions: Required<FeatureFlowOptions> = {
  maxDepth: 4,
  maxNodes: 12,
  includeBranches: false,
  includeReturns: true,
  includeDataFlow: true,
  detailLevel: "summary"
};

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
    mode: "core_modules",
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

export function traceFeatureFlow(store: ProjectKgStore, query: string, options: FeatureFlowOptions = {}): FeatureFlow {
  const resolvedOptions = {
    ...defaultFeatureFlowOptions,
    ...options
  };
  const matches = findRootSymbolMatches(store.symbolIndex, query);
  const root = matches[0] ? store.symbolIndex.symbols.find((symbol) => symbol.id === matches[0].symbolId) : undefined;
  if (!root) {
    return {
      query,
      matches,
      options: resolvedOptions,
      steps: [],
      edges: [],
      truncated: false
    };
  }

  const symbolMap = new Map(store.symbolIndex.symbols.map((symbol) => [symbol.id, symbol]));
  const steps: FeatureFlowStep[] = [];
  const edges: FeatureFlowEdge[] = [];
  const visited = new Set<string>();
  let truncated = false;

  function visit(symbol: SymbolNode, depth: number, isMainPath: boolean, incomingSequence?: number): void {
    if (depth > resolvedOptions.maxDepth || visited.has(symbol.id)) {
      return;
    }

    if (steps.length >= resolvedOptions.maxNodes) {
      truncated = true;
      return;
    }

    visited.add(symbol.id);
    steps.push(symbolToFlowStep(symbol, resolvedOptions.detailLevel, isMainPath, incomingSequence));

    const outgoing = orderedOutgoingCalls(store.callGraph.edges, symbol.id, symbolMap);
    const selectedOutgoing = resolvedOptions.includeBranches ? outgoing : outgoing.slice(0, 1);
    for (const [index, edge] of selectedOutgoing.entries()) {
      if (!edge.to) {
        continue;
      }

      const target = symbolMap.get(edge.to);
      if (!target) {
        continue;
      }

      const edgeSequence = edge.sequence ?? index + 1;
      const isBranch = index > 0;
      edges.push(callEdgeToFlowEdge(edge, isBranch));
      if (resolvedOptions.includeDataFlow) {
        edges.push(...dataFlowEdgesForCall(edge));
      }
      if (resolvedOptions.includeReturns) {
        const returnEdge = returnFlowEdgeForCall(edge);
        if (returnEdge) {
          edges.push(returnEdge);
        }
      }

      visit(target, depth + 1, isMainPath && !isBranch, edgeSequence);
    }

    if (!resolvedOptions.includeBranches && outgoing.length > selectedOutgoing.length) {
      truncated = true;
    }
  }

  visit(root, 0, true);

  return {
    query,
    rootSymbolId: root.id,
    matches,
    options: resolvedOptions,
    steps,
    edges,
    truncated
  };
}

export function buildFeatureTraceDiagram(trace: FeatureTrace): DiagramModel {
  return {
    title: `Feature Trace: ${trace.query}`,
    mode: "feature_trace",
    nodes: trace.steps.map((step) => ({
      id: step.symbolId,
      label: step.label,
      detail: step.detail,
      kind: "symbol"
    })),
    edges: trace.edges
  };
}

export function buildFeatureFlowDiagram(flow: FeatureFlow): DiagramModel {
  return {
    title: `Feature Flow: ${flow.query}`,
    mode: "feature_flow",
    nodes: flow.steps.map((step) => ({
      id: step.symbolId,
      label: step.label,
      detail: step.detail,
      kind: step.isMainPath ? "flow-main" : "flow-branch",
      sequence: step.sequence,
      isMainPath: step.isMainPath
    })),
    edges: flow.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      label: edge.label,
      kind: edge.kind,
      sequence: edge.sequence,
      detail: edge.detail
    })),
    legend: [
      { label: "Call order", kind: "call" },
      { label: "Branch/helper call", kind: "branch" },
      { label: "Data input", kind: "data_in" },
      { label: "Data output", kind: "data_out" },
      { label: "Return value", kind: "return" }
    ],
    notes: flow.truncated ? ["Trace was bounded by maxDepth, maxNodes, or branch filtering."] : undefined
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

function orderedOutgoingCalls(edges: CallEdge[], symbolId: string, symbolMap: Map<string, SymbolNode>): CallEdge[] {
  return edges
    .filter((edge) => edge.from === symbolId && edge.to && symbolMap.has(edge.to))
    .sort((a, b) => (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER) || a.location.startLine - b.location.startLine)
    .slice(0, 8);
}

function callEdgeToFlowEdge(edge: CallEdge, isBranch: boolean): FeatureFlowEdge {
  return {
    from: edge.from,
    to: edge.to!,
    label: `${edge.sequence ? `${edge.sequence}. ` : ""}${edge.calleeName}`,
    kind: isBranch ? "branch" : "call",
    sequence: edge.sequence,
    detail: callEdgeDetail(edge)
  };
}

function dataFlowEdgesForCall(edge: CallEdge): FeatureFlowEdge[] {
  const flowEdges: FeatureFlowEdge[] = [];
  if (edge.arguments?.length) {
    flowEdges.push({
      from: edge.from,
      to: edge.to!,
      label: `in: ${edge.arguments.join(", ")}`,
      kind: "data_in",
      sequence: edge.sequence,
      detail: edge.expression
    });
  }

  if (edge.assignmentTarget) {
    flowEdges.push({
      from: edge.to!,
      to: edge.from,
      label: `out: ${edge.assignmentTarget}`,
      kind: "data_out",
      sequence: edge.sequence,
      detail: edge.expression
    });
  }

  return flowEdges;
}

function returnFlowEdgeForCall(edge: CallEdge): FeatureFlowEdge | undefined {
  if (!edge.returnExpression) {
    return undefined;
  }

  return {
    from: edge.to!,
    to: edge.from,
    label: `return: ${summarizeText(edge.returnExpression, 48)}`,
    kind: "return",
    sequence: edge.sequence,
    detail: edge.returnExpression
  };
}

function callEdgeDetail(edge: CallEdge): string {
  const parts = [
    edge.receiver ? `receiver: ${edge.receiver}` : undefined,
    edge.arguments?.length ? `args: ${edge.arguments.join(", ")}` : undefined,
    edge.assignmentTarget ? `assigns: ${edge.assignmentTarget}` : undefined,
    `${edge.filePath}:${edge.location.startLine}`
  ];
  return parts.filter(Boolean).join("\n");
}

function symbolToFlowStep(
  symbol: SymbolNode,
  detailLevel: "summary" | "full",
  isMainPath: boolean,
  sequence?: number
): FeatureFlowStep {
  const traceStep = symbolToTraceStep(symbol);
  const annotation = symbol.docstring ?? symbol.leadingComment ?? `${symbol.kind} ${symbol.qualifiedName}`;
  const detailParts = detailLevel === "full"
    ? [traceStep.detail, symbol.docstring, symbol.leadingComment].filter(Boolean)
    : [traceStep.detail, annotation].filter(Boolean);

  return {
    symbolId: symbol.id,
    label: symbol.qualifiedName,
    annotation,
    detail: detailParts.join("\n"),
    filePath: symbol.filePath,
    location: symbol.location,
    sequence,
    isMainPath
  };
}

function summarizeText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
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
