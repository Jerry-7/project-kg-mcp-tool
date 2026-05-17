import type { SourceLocation } from "./symbol-index.js";

export interface CallEdge {
  from: string;
  to?: string;
  expression: string;
  calleeName: string;
  filePath: string;
  location: SourceLocation;
  sequence?: number;
  arguments?: string[];
  assignmentTarget?: string;
  returnExpression?: string;
  receiver?: string;
  confidence: "high" | "medium" | "low";
}

export interface CallGraph {
  schemaVersion: 1;
  edges: CallEdge[];
}

export interface FeatureTraceStep {
  symbolId: string;
  label: string;
  detail: string;
  filePath: string;
}

export interface FeatureTrace {
  query: string;
  rootSymbolId?: string;
  matches?: FeatureTraceMatch[];
  steps: FeatureTraceStep[];
  edges: Array<{ from: string; to: string; label?: string }>;
}

export type FeatureFlowDetailLevel = "summary" | "full";

export interface FeatureFlowOptions {
  maxDepth?: number;
  maxNodes?: number;
  includeBranches?: boolean;
  includeReturns?: boolean;
  includeDataFlow?: boolean;
  detailLevel?: FeatureFlowDetailLevel;
}

export type FeatureFlowEdgeKind = "call" | "branch" | "data_in" | "data_out" | "return";

export interface FeatureFlowStep {
  symbolId: string;
  label: string;
  annotation: string;
  detail: string;
  filePath: string;
  location: SourceLocation;
  sequence?: number;
  isMainPath: boolean;
}

export interface FeatureFlowEdge {
  from: string;
  to: string;
  label?: string;
  kind: FeatureFlowEdgeKind;
  sequence?: number;
  detail?: string;
}

export interface FeatureFlow {
  query: string;
  rootSymbolId?: string;
  matches?: FeatureTraceMatch[];
  options: Required<FeatureFlowOptions>;
  steps: FeatureFlowStep[];
  edges: FeatureFlowEdge[];
  truncated: boolean;
}

export interface FeatureTraceMatch {
  symbolId: string;
  label: string;
  kind: string;
  filePath: string;
  score: number;
  reason: string;
}
