import { z } from "zod";
import { traceFeature } from "../core/graph-builder.js";
import { readProjectKgStore } from "../core/index-store.js";

export const traceFeatureFlowInputSchema = z.object({
  projectPath: z.string().min(1),
  query: z.string().min(1),
  maxDepth: z.number().int().positive().optional()
});

export async function traceFeatureFlowTool(input: unknown) {
  const { projectPath, query, maxDepth } = traceFeatureFlowInputSchema.parse(input);
  const store = await readProjectKgStore(projectPath);
  return traceFeature(store, query, maxDepth);
}
