import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DiagramModel } from "../types/drawio.js";

const nodeWidth = 220;
const nodeHeight = 72;
const xGap = 280;
const yGap = 120;
const architectureGroups = ["entrypoint", "interface", "service", "domain", "repository", "model", "package", "module"];
const groupLabels = new Map<string, string>([
  ["entrypoint", "Entrypoints"],
  ["interface", "Interface Layer"],
  ["service", "Service Layer"],
  ["domain", "Domain/Core"],
  ["repository", "Data Access"],
  ["model", "Models/Schemas"],
  ["package", "Packages"],
  ["module", "Other Modules"]
]);

export async function writeDrawioDiagram(outputPath: string, model: DiagramModel): Promise<void> {
  const xml = renderDrawioXml(model);
  const resolvedOutputPath = path.resolve(outputPath);
  await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, xml, "utf8");
}

export function renderDrawioXml(model: DiagramModel): string {
  const cells: string[] = [
    `<mxCell id="0" />`,
    `<mxCell id="1" parent="0" />`
  ];

  const positions = layoutNodes(model);
  const groups = groupedNodeIds(model);
  for (const group of groups) {
    const position = positions.get(`group:${group}`);
    if (!position) {
      continue;
    }
    cells.push(
      `<mxCell id="group-${escapeXml(group)}" value="${escapeXml(groupLabels.get(group) ?? group)}" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontStyle=1;fontColor=#334155;" vertex="1" parent="1">` +
        `<mxGeometry x="${position.x}" y="${position.y}" width="${nodeWidth}" height="28" as="geometry" />` +
      `</mxCell>`
    );
  }

  model.nodes.forEach((node, index) => {
    const position = positions.get(node.id) ?? {
      x: 80 + (index % 3) * xGap,
      y: 80 + Math.floor(index / 3) * yGap
    };
    const value = escapeXml(node.detail ? `${node.label}\n${node.detail}` : node.label);
    cells.push(
      `<mxCell id="${escapeXml(node.id)}" value="${value}" style="${nodeStyle(node.kind)}" vertex="1" parent="1">` +
        `<mxGeometry x="${position.x}" y="${position.y}" width="${nodeWidth}" height="${nodeHeight}" as="geometry" />` +
      `</mxCell>`
    );
  });

  model.edges.forEach((edge, index) => {
    cells.push(
      `<mxCell id="edge-${index}" value="${escapeXml(edge.label ?? "")}" style="endArrow=block;html=1;rounded=0;strokeColor=#4b5563;" edge="1" parent="1" source="${escapeXml(edge.from)}" target="${escapeXml(edge.to)}">` +
        `<mxGeometry relative="1" as="geometry" />` +
      `</mxCell>`
    );
  });

  return [
    `<mxfile host="project-kg" modified="${new Date().toISOString()}" agent="project-kg">`,
    `<diagram name="${escapeXml(model.title)}">`,
    `<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">`,
    `<root>`,
    ...cells,
    `</root>`,
    `</mxGraphModel>`,
    `</diagram>`,
    `</mxfile>`
  ].join("");
}

function nodeStyle(kind?: string): string {
  if (kind === "entrypoint") {
    return "rounded=1;whiteSpace=wrap;html=1;fillColor=#dbeafe;strokeColor=#2563eb;fontColor=#111827;";
  }

  if (kind === "interface") {
    return "rounded=1;whiteSpace=wrap;html=1;fillColor=#e0f2fe;strokeColor=#0284c7;fontColor=#111827;";
  }

  if (kind === "service") {
    return "rounded=1;whiteSpace=wrap;html=1;fillColor=#ede9fe;strokeColor=#7c3aed;fontColor=#111827;";
  }

  if (kind === "domain") {
    return "rounded=1;whiteSpace=wrap;html=1;fillColor=#fef3c7;strokeColor=#d97706;fontColor=#111827;";
  }

  if (kind === "repository") {
    return "rounded=1;whiteSpace=wrap;html=1;fillColor=#ffedd5;strokeColor=#ea580c;fontColor=#111827;";
  }

  if (kind === "model") {
    return "rounded=1;whiteSpace=wrap;html=1;fillColor=#fce7f3;strokeColor=#db2777;fontColor=#111827;";
  }

  if (kind === "package") {
    return "rounded=1;whiteSpace=wrap;html=1;fillColor=#f1f5f9;strokeColor=#64748b;fontColor=#111827;dashed=1;";
  }

  if (kind === "symbol") {
    return "rounded=1;whiteSpace=wrap;html=1;fillColor=#dcfce7;strokeColor=#16a34a;fontColor=#111827;";
  }

  return "rounded=1;whiteSpace=wrap;html=1;fillColor=#f8fafc;strokeColor=#475569;fontColor=#111827;";
}

function layoutNodes(model: DiagramModel): Map<string, { x: number; y: number }> {
  if (!usesArchitectureGroups(model)) {
    return new Map(
      model.nodes.map((node, index) => [
        node.id,
        {
          x: 80 + (index % 3) * xGap,
          y: 80 + Math.floor(index / 3) * yGap
        }
      ])
    );
  }

  const positions = new Map<string, { x: number; y: number }>();
  const nodesByGroup = new Map<string, typeof model.nodes>();
  for (const node of model.nodes) {
    const group = architectureGroups.includes(node.group ?? "") ? node.group! : "module";
    nodesByGroup.set(group, [...(nodesByGroup.get(group) ?? []), node]);
  }

  let column = 0;
  for (const group of architectureGroups) {
    const nodes = nodesByGroup.get(group);
    if (!nodes?.length) {
      continue;
    }

    const x = 80 + column * xGap;
    positions.set(`group:${group}`, { x, y: 40 });
    nodes.forEach((node, row) => {
      positions.set(node.id, { x, y: 90 + row * yGap });
    });
    column += 1;
  }

  return positions;
}

function groupedNodeIds(model: DiagramModel): string[] {
  if (!usesArchitectureGroups(model)) {
    return [];
  }

  const groups = new Set(model.nodes.map((node) => node.group).filter((group): group is string => Boolean(group)));
  return architectureGroups.filter((group) => groups.has(group));
}

function usesArchitectureGroups(model: DiagramModel): boolean {
  return model.nodes.some((node) => node.group && architectureGroups.includes(node.group));
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
