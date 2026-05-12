import { z } from "zod";
import { buildProjectIndex } from "../core/build-project-index.js";

export const buildProjectIndexInputSchema = z.object({
  projectPath: z.string().min(1),
  maxDepth: z.number().int().positive().optional(),
  force: z.boolean().optional()
});

export async function buildProjectIndexTool(input: unknown) {
  const args = buildProjectIndexInputSchema.parse(input);
  return buildProjectIndex(args);
}
