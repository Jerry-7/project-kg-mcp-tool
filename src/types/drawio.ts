export type DiagramMode = "core_modules" | "feature_trace";

export interface DiagramNode {
  id: string;
  label: string;
  detail?: string;
  kind?: string;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export interface DiagramModel {
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}
