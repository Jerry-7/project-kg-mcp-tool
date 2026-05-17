import type { FeatureFlowEdgeKind } from "./call-graph.js";

export type DiagramMode = "core_modules" | "feature_trace" | "feature_flow";

export interface DiagramNode {
  id: string;
  label: string;
  detail?: string;
  kind?: string;
  group?: string;
  sequence?: number;
  isMainPath?: boolean;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  kind?: FeatureFlowEdgeKind;
  sequence?: number;
  detail?: string;
}

export interface DiagramModel {
  title: string;
  mode?: DiagramMode;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  legend?: Array<{ label: string; kind: FeatureFlowEdgeKind }>;
  notes?: string[];
}
