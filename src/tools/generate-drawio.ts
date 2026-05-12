import path from "node:path";
import { z } from "zod";
import { writeDrawioDiagram } from "../core/drawio-writer.js";
import { buildCoreModulesDiagram, buildFeatureTraceDiagram, traceFeature } from "../core/graph-builder.js";
import { readProjectKgStore } from "../core/index-store.js";

export const generateDrawioInputSchema = z.object({
  projectPath: z.string().min(1),
  mode: z.enum(["core_modules", "feature_trace"]),
  outputPath: z.string().min(1).optional(),
  query: z.string().optional(),
  maxDepth: z.number().int().positive().optional()
});

export async function generateDrawioTool(input: unknown) {
  const args = generateDrawioInputSchema.parse(input);
  const store = await readProjectKgStore(args.projectPath);
  const model = args.mode === "core_modules"
    ? buildCoreModulesDiagram(store)
    : buildFeatureTraceDiagram(traceFeature(store, args.query ?? "", args.maxDepth));

  const outputPath = args.outputPath ?? path.join(
    args.projectPath,
    args.mode === "core_modules" ? "project-core.drawio" : "feature-trace.drawio"
  );

  await writeDrawioDiagram(outputPath, model);
  return {
    outputPath,
    nodeCount: model.nodes.length,
    edgeCount: model.edges.length
  };
}
