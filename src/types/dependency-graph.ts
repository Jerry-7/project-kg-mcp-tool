export interface DependencyNode {
  id: string;
  path: string;
  kind: "file" | "package" | "external";
  label: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: "imports";
  imported: string[];
  rawModule: string;
  confidence: "high" | "medium" | "low";
}

export interface DependencyGraph {
  schemaVersion: 1;
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}
