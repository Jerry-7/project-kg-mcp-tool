import type { SourceLocation } from "./symbol-index.js";

export interface CallEdge {
  from: string;
  to?: string;
  expression: string;
  calleeName: string;
  filePath: string;
  location: SourceLocation;
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

export interface FeatureTraceMatch {
  symbolId: string;
  label: string;
  kind: string;
  filePath: string;
  score: number;
  reason: string;
}
