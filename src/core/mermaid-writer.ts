import type { DiagramModel } from "../types/drawio.js";

export function renderMermaidMarkdown(model: DiagramModel): string {
  const lines: string[] = [`flowchart LR`];
  const ids = new Map<string, string>();
  let nextId = 0;

  function safeId(key: string): string {
    const existing = ids.get(key);
    if (existing) return existing;
    const id = `n${nextId++}`;
    ids.set(key, id);
    return id;
  }

  const isArchitecture = model.mode === "core_modules";

  if (isArchitecture) {
    renderArchitectureNodes(model, lines, safeId);
  } else {
    renderFlowNodes(model, lines, safeId);
  }

  lines.push("");

  // Edges
  for (const edge of model.edges) {
    const from = safeId(edge.from);
    const to = safeId(edge.to);
    const style = edgeStyleDef(edge.kind);
    const label = edge.label ? `${style}|${escapeMermaidText(edge.label)}|` : style;
    lines.push(`  ${from} ${label} ${to}`);
  }

  // Class definitions for styling
  lines.push("");
  lines.push("  classDef branch fill:#f8fafc,stroke:#64748b,stroke-dasharray:4");
  lines.push("  classDef entrypoint fill:#dbeafe,stroke:#2563eb");
  lines.push("  classDef interface fill:#e0f2fe,stroke:#0284c7");
  lines.push("  classDef service fill:#ede9fe,stroke:#7c3aed");
  lines.push("  classDef domain fill:#fef3c7,stroke:#d97706");
  lines.push("  classDef repository fill:#ffedd5,stroke:#ea580c");
  lines.push("  classDef model fill:#fce7f3,stroke:#db2777");
  lines.push("  classDef package fill:#f1f5f9,stroke:#64748b,stroke-dasharray:4");

  // Apply classDef for architecture groups
  if (isArchitecture) {
    const groups = groupNodesByRole(model);
    for (const [role, nodes] of Object.entries(groups)) {
      if (nodes.length === 0 || role === "module") continue;
      lines.push(`  class ${nodes.map((n) => safeId(n.id)).join(",")} ${role}`);
    }
  }

  lines.push("");

  // Legend
  if (model.legend?.length) {
    renderLegend(model, lines, safeId);
  }

  return ["```mermaid", ...lines, "```"].join("\n");
}

function renderArchitectureNodes(
  model: DiagramModel,
  lines: string[],
  safeId: (key: string) => string
): void {
  const groups = groupNodesByRole(model);
  const groupOrder = ["entrypoint", "interface", "service", "domain", "repository", "model", "package", "module"];
  const rendered = new Set<string>();

  for (const role of groupOrder) {
    const nodes = groups[role];
    if (!nodes || nodes.length === 0) continue;
    lines.push(`  subgraph ${role}[${roleLabel(role)}]`);
    for (const node of nodes) {
      lines.push(`    ${safeId(node.id)}[${escapeMermaidText(node.label)}]`);
    }
    lines.push(`  end`);
    rendered.add(role);
  }

  for (const [role, nodes] of Object.entries(groups)) {
    if (rendered.has(role)) continue;
    lines.push(`  subgraph ${role}[${roleLabel(role)}]`);
    for (const node of nodes) {
      lines.push(`    ${safeId(node.id)}[${escapeMermaidText(node.label)}]`);
    }
    lines.push(`  end`);
  }
}

function renderFlowNodes(
  model: DiagramModel,
  lines: string[],
  safeId: (key: string) => string
): void {
  for (const node of model.nodes) {
    const label = escapeMermaidText(node.label);
    if (node.isMainPath === false) {
      lines.push(`  ${safeId(node.id)}[${label}]:::branch`);
    } else {
      lines.push(`  ${safeId(node.id)}[${label}]`);
    }
  }
}

function renderLegend(
  model: DiagramModel,
  lines: string[],
  safeId: (key: string) => string
): void {
  lines.push("  subgraph legend[Legend]");
  const symbols: Record<string, string> = {
    call: "→",
    branch: "-→",
    data_in: "·→in",
    data_out: "·→out",
    return: "··→"
  };
  for (const item of model.legend ?? []) {
    const sym = symbols[item.kind] ?? "→";
    lines.push(`    l${safeId(item.label)}["${sym} ${escapeMermaidText(item.label)}"]`);
  }
  lines.push("  end");
}

function groupNodesByRole(model: DiagramModel): Record<string, typeof model.nodes> {
  const groups: Record<string, typeof model.nodes> = {};
  for (const node of model.nodes) {
    const role = node.group ?? node.kind ?? "default";
    groups[role] = [...(groups[role] ?? []), node];
  }
  return groups;
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    entrypoint: "Entrypoints",
    interface: "Interface Layer",
    service: "Service Layer",
    domain: "Domain/Core",
    repository: "Data Access",
    model: "Models/Schemas",
    package: "Packages",
    module: "Other Modules"
  };
  return labels[role] ?? role;
}

function edgeStyleDef(kind?: string): string {
  switch (kind) {
    case "data_in":
      return "-.->";
    case "data_out":
      return "-.->";
    case "return":
      return "-.->";
    case "branch":
      return "-.->";
    default:
      return "-->";
  }
}

function escapeMermaidText(value: string): string {
  return value
    .replace(/#/g, "#35;")
    .replace(/"/g, "#quot;")
    .replace(/\(/g, "#40;")
    .replace(/\)/g, "#41;")
    .replace(/</g, "#60;")
    .replace(/>/g, "#62;")
    .replace(/\n/g, " ")
    .trim();
}
