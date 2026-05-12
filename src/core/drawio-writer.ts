import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { DiagramModel } from "../types/drawio.js";

const nodeWidth = 220;
const nodeHeight = 72;
const xGap = 280;
const yGap = 120;

export async function writeDrawioDiagram(outputPath: string, model: DiagramModel): Promise<void> {
  const xml = renderDrawioXml(model);
  await writeFile(path.resolve(outputPath), xml, "utf8");
}

export function renderDrawioXml(model: DiagramModel): string {
  const cells: string[] = [
    `<mxCell id="0" />`,
    `<mxCell id="1" parent="0" />`
  ];

  model.nodes.forEach((node, index) => {
    const x = 80 + (index % 3) * xGap;
    const y = 80 + Math.floor(index / 3) * yGap;
    const value = escapeXml(node.detail ? `${node.label}\n${node.detail}` : node.label);
    cells.push(
      `<mxCell id="${escapeXml(node.id)}" value="${value}" style="${nodeStyle(node.kind)}" vertex="1" parent="1">` +
        `<mxGeometry x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" as="geometry" />` +
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

  if (kind === "symbol") {
    return "rounded=1;whiteSpace=wrap;html=1;fillColor=#dcfce7;strokeColor=#16a34a;fontColor=#111827;";
  }

  return "rounded=1;whiteSpace=wrap;html=1;fillColor=#f8fafc;strokeColor=#475569;fontColor=#111827;";
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
