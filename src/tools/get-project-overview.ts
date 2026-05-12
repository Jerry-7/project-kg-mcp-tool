import { z } from "zod";
import { readProjectKgStore } from "../core/index-store.js";

export const getProjectOverviewInputSchema = z.object({
  projectPath: z.string().min(1)
});

export async function getProjectOverviewTool(input: unknown) {
  const { projectPath } = getProjectOverviewInputSchema.parse(input);
  const store = await readProjectKgStore(projectPath);
  const sourceFiles = store.projectIndex.files.filter((file) => file.path.endsWith(".py"));
  const coreFiles = sourceFiles
    .filter((file) => file.kind === "entrypoint" || /\/(api|routes|services|core|domain|models)\//.test(`/${file.path}`))
    .map((file) => file.path)
    .slice(0, 30);

  return {
    rootPath: store.projectIndex.rootPath,
    language: store.projectIndex.language,
    generatedAt: store.projectIndex.generatedAt,
    entrypoints: store.projectIndex.entrypoints,
    packages: store.projectIndex.packages,
    fileCount: store.projectIndex.files.length,
    symbolCount: store.symbolIndex.symbols.length,
    dependencyCount: store.dependencyGraph.edges.length,
    callCount: store.callGraph.edges.length,
    coreFiles
  };
}
