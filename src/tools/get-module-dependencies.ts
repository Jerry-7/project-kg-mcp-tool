import { z } from "zod";
import { readProjectKgStore } from "../core/index-store.js";

export const getModuleDependenciesInputSchema = z.object({
  projectPath: z.string().min(1),
  includeExternal: z.boolean().optional()
});

export async function getModuleDependenciesTool(input: unknown) {
  const { projectPath, includeExternal = false } = getModuleDependenciesInputSchema.parse(input);
  const store = await readProjectKgStore(projectPath);
  return {
    nodes: includeExternal
      ? store.dependencyGraph.nodes
      : store.dependencyGraph.nodes.filter((node) => node.kind !== "external"),
    edges: includeExternal
      ? store.dependencyGraph.edges
      : store.dependencyGraph.edges.filter((edge) => !edge.to.startsWith("external:"))
  };
}
