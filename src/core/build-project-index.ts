import { buildCallGraph } from "./call-analyzer.js";
import { buildDependencyGraph } from "./dependency-analyzer.js";
import { parsePythonFile } from "./python-parser.js";
import { scanPythonProject } from "./scanner.js";
import { buildSymbolIndex } from "./symbol-analyzer.js";
import { writeProjectKgStore } from "./index-store.js";
import type { BuildProjectIndexOptions, BuildProjectIndexResult } from "../types/project-index.js";

export async function buildProjectIndex(options: BuildProjectIndexOptions): Promise<BuildProjectIndexResult> {
  const projectIndex = await scanPythonProject({
    projectPath: options.projectPath,
    maxDepth: options.maxDepth
  });

  const pythonFiles = projectIndex.files.filter((file) => file.path.endsWith(".py"));
  const parsedFiles = await Promise.all(
    pythonFiles.map((file) => parsePythonFile(file.absolutePath, file.path))
  );

  const symbolIndex = buildSymbolIndex(parsedFiles);
  const dependencyGraph = buildDependencyGraph(projectIndex, parsedFiles);
  const callGraph = buildCallGraph(parsedFiles, symbolIndex);
  const indexPath = await writeProjectKgStore(options.projectPath, {
    projectIndex,
    dependencyGraph,
    symbolIndex,
    callGraph
  });

  return {
    indexPath,
    fileCount: projectIndex.files.length,
    symbolCount: symbolIndex.symbols.length,
    dependencyCount: dependencyGraph.edges.length,
    callCount: callGraph.edges.length
  };
}
