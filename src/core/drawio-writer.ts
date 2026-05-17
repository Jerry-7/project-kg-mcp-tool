import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DiagramModel } from "../types/drawio.js";

const nodeWidth = 220;
const nodeHeight = 72;
const flowNodeWidth = 260;
const flowNodeHeight = 108;
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
  for (const note of model.notes ?? []) {
    cells.push(
      `<mxCell id="note-${cells.length}" value="${escapeXml(note)}" style="shape=note;whiteSpace=wrap;html=1;backgroundOutline=1;darkOpacity=0.05;fillColor=#fff7ed;strokeColor=#f97316;fontColor=#7c2d12;" vertex="1" parent="1">` +
        `<mxGeometry x="80" y="20" width="360" height="64" as="geometry" />` +
      `</mxCell>`
    );
  }

  if (model.legend?.length) {
    cells.push(...renderLegendCells(model));
  }

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
    const dimensions = model.mode === "feature_flow"
      ? { width: flowNodeWidth, height: flowNodeHeight }
      : { width: nodeWidth, height: nodeHeight };
    cells.push(
      `<mxCell id="${escapeXml(node.id)}" value="${value}" style="${nodeStyle(node.kind)}" vertex="1" parent="1">` +
        `<mxGeometry x="${position.x}" y="${position.y}" width="${dimensions.width}" height="${dimensions.height}" as="geometry" />` +
      `</mxCell>`
    );
  });

  model.edges.forEach((edge, index) => {
    cells.push(
      `<mxCell id="edge-${index}" value="${escapeXml(edge.label ?? "")}" style="${edgeStyle(edge.kind)}" edge="1" parent="1" source="${escapeXml(edge.from)}" target="${escapeXml(edge.to)}">` +
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

  if (kind === "flow-main") {
    return "rounded=1;whiteSpace=wrap;html=1;fillColor=#ecfdf5;strokeColor=#059669;fontColor=#111827;fontStyle=1;";
  }

  if (kind === "flow-branch") {
    return "rounded=1;whiteSpace=wrap;html=1;fillColor=#f8fafc;strokeColor=#64748b;fontColor=#111827;dashed=1;";
  }

  return "rounded=1;whiteSpace=wrap;html=1;fillColor=#f8fafc;strokeColor=#475569;fontColor=#111827;";
}

function layoutNodes(model: DiagramModel): Map<string, { x: number; y: number }> {
  if (model.mode === "feature_flow") {
    return layoutFeatureFlowNodes(model);
  }

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

function layoutFeatureFlowNodes(model: DiagramModel): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const mainNodes = model.nodes.filter((node) => node.isMainPath !== false);
  const branchNodes = model.nodes.filter((node) => node.isMainPath === false);

  mainNodes.forEach((node, index) => {
    positions.set(node.id, { x: 80 + index * 340, y: 180 });
  });

  branchNodes.forEach((node, index) => {
    positions.set(node.id, { x: 80 + index * 340, y: 340 });
  });

  return positions;
}

function edgeStyle(kind?: string): string {
  if (kind === "data_in") {
    return "endArrow=block;html=1;rounded=0;strokeColor=#2563eb;fontColor=#1d4ed8;dashed=1;";
  }

  if (kind === "data_out") {
    return "endArrow=block;html=1;rounded=0;strokeColor=#16a34a;fontColor=#15803d;dashed=1;";
  }

  if (kind === "return") {
    return "endArrow=block;html=1;rounded=0;strokeColor=#059669;fontColor=#047857;dashed=1;";
  }

  if (kind === "branch") {
    return "endArrow=block;html=1;rounded=0;strokeColor=#64748b;fontColor=#475569;dashed=1;";
  }

  return "endArrow=block;html=1;rounded=0;strokeColor=#374151;fontColor=#111827;";
}

function renderLegendCells(model: DiagramModel): string[] {
  const cells: string[] = [];
  const x = 80;
  const y = 70;
  cells.push(
    `<mxCell id="legend-title" value="Legend" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontStyle=1;fontColor=#334155;" vertex="1" parent="1">` +
      `<mxGeometry x="${x}" y="${y}" width="120" height="24" as="geometry" />` +
    `</mxCell>`
  );

  model.legend?.forEach((item, index) => {
    const rowY = y + 32 + index * 28;
    const sourceId = `legend-${index}-source`;
    const targetId = `legend-${index}-target`;
    cells.push(
      `<mxCell id="${sourceId}" value="" style="ellipse;html=1;fillColor=#ffffff;strokeColor=none;" vertex="1" parent="1">` +
        `<mxGeometry x="${x}" y="${rowY + 7}" width="4" height="4" as="geometry" />` +
      `</mxCell>`,
      `<mxCell id="${targetId}" value="" style="ellipse;html=1;fillColor=#ffffff;strokeColor=none;" vertex="1" parent="1">` +
        `<mxGeometry x="${x + 58}" y="${rowY + 7}" width="4" height="4" as="geometry" />` +
      `</mxCell>`,
      `<mxCell id="legend-edge-${index}" value="" style="${edgeStyle(item.kind)}" edge="1" parent="1" source="${sourceId}" target="${targetId}">` +
        `<mxGeometry relative="1" as="geometry" />` +
      `</mxCell>`,
      `<mxCell id="legend-label-${index}" value="${escapeXml(item.label)}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontColor=#334155;" vertex="1" parent="1">` +
        `<mxGeometry x="${x + 76}" y="${rowY}" width="180" height="20" as="geometry" />` +
      `</mxCell>`
    );
  });

  return cells;
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
