import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { writeDrawioDiagram } from "../core/drawio-writer.js";
import { buildCoreModulesDiagram, buildFeatureFlowDiagram, buildFeatureTraceDiagram, traceFeature, traceFeatureFlow } from "../core/graph-builder.js";
import { readProjectKgStore } from "../core/index-store.js";
import { renderMermaidMarkdown } from "../core/mermaid-writer.js";

export const generateDrawioInputSchema = z.object({
  projectPath: z.string().min(1),
  mode: z.enum(["core_modules", "feature_trace", "feature_flow"]),
  outputPath: z.string().min(1).optional(),
  format: z.enum(["drawio", "mermaid"]).optional(),
  query: z.string().optional(),
  maxDepth: z.number().int().positive().optional(),
  maxNodes: z.number().int().positive().optional(),
  includeBranches: z.boolean().optional(),
  includeReturns: z.boolean().optional(),
  includeDataFlow: z.boolean().optional(),
  detailLevel: z.enum(["summary", "full"]).optional()
});

export async function generateDrawioTool(input: unknown) {
  const args = generateDrawioInputSchema.parse(input);
  const format = args.format ?? "mermaid";
  const store = await readProjectKgStore(args.projectPath);
  const model = args.mode === "core_modules"
    ? buildCoreModulesDiagram(store)
    : args.mode === "feature_flow"
      ? buildFeatureFlowDiagram(traceFeatureFlow(store, args.query ?? "", {
        maxDepth: args.maxDepth,
        maxNodes: args.maxNodes,
        includeBranches: args.includeBranches,
        includeReturns: args.includeReturns,
        includeDataFlow: args.includeDataFlow,
        detailLevel: args.detailLevel
      }))
      : buildFeatureTraceDiagram(traceFeature(store, args.query ?? "", args.maxDepth));

  const ext = format === "mermaid" ? "md" : "drawio";
  const defaultOutputPath = path.join(
    args.projectPath,
    args.mode === "core_modules" ? `project-core.${ext}` : args.mode === "feature_flow" ? `feature-flow.${ext}` : `feature-trace.${ext}`
  );
  const outputPath = args.outputPath ?? defaultOutputPath;

  if (format === "mermaid") {
    const content = renderMermaidMarkdown(model);
    const resolvedOutputPath = path.resolve(outputPath);
    await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
    await writeFile(resolvedOutputPath, content, "utf8");
    return {
      outputPath,
      format: "mermaid" as const,
      nodeCount: model.nodes.length,
      edgeCount: model.edges.length,
      content,
      notes: model.notes
    };
  }

  await writeDrawioDiagram(outputPath, model);
  return {
    outputPath,
    format: "drawio" as const,
    nodeCount: model.nodes.length,
    edgeCount: model.edges.length
  };
}
