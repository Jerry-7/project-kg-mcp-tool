import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { shouldIgnorePath, toProjectRelative } from "./ignore-rules.js";
import type { ProjectIndex, SourceFileInfo, SourceFileKind } from "../types/project-index.js";

const entrypointNames = new Set(["main.py", "app.py", "server.py", "manage.py", "__main__.py"]);

export interface ScanProjectOptions {
  projectPath: string;
  maxDepth?: number;
}

export async function scanPythonProject(options: ScanProjectOptions): Promise<ProjectIndex> {
  const rootPath = path.resolve(options.projectPath);
  const maxDepth = options.maxDepth ?? 8;
  const files: SourceFileInfo[] = [];
  const packages = new Set<string>();

  await walk(rootPath, rootPath, 0, maxDepth, files, packages);

  const entrypoints = files
    .filter((file) => file.kind === "entrypoint")
    .map((file) => file.path);

  return {
    schemaVersion: 1,
    rootPath,
    language: "python",
    generatedAt: new Date().toISOString(),
    entrypoints,
    packages: [...packages].sort(),
    files: files.sort((a, b) => a.path.localeCompare(b.path))
  };
}

async function walk(
  rootPath: string,
  currentPath: string,
  depth: number,
  maxDepth: number,
  files: SourceFileInfo[],
  packages: Set<string>
): Promise<void> {
  if (depth > maxDepth) {
    return;
  }

  const entries = await readdir(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(currentPath, entry.name);
    const relativePath = toProjectRelative(rootPath, absolutePath);
    if (shouldIgnorePath(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      await walk(rootPath, absolutePath, depth + 1, maxDepth, files, packages);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const kind = classifyFile(entry.name, relativePath);
    if (!kind) {
      continue;
    }

    const fileStat = await stat(absolutePath);
    files.push({
      path: relativePath,
      absolutePath,
      kind,
      sizeBytes: fileStat.size
    });

    if (entry.name === "__init__.py") {
      packages.add(path.dirname(relativePath).replaceAll(path.sep, "/"));
    }
  }
}

function classifyFile(fileName: string, relativePath: string): SourceFileKind | undefined {
  if (fileName.endsWith(".py")) {
    if (isTestPath(relativePath)) {
      return "test";
    }
    if (entrypointNames.has(fileName)) {
      return "entrypoint";
    }
    return "source";
  }

  if (["pyproject.toml", "setup.py", "setup.cfg", "requirements.txt"].includes(fileName)) {
    return "config";
  }

  if (/^readme(\..*)?$/i.test(fileName) || relativePath.startsWith("docs/")) {
    return "documentation";
  }

  return undefined;
}

function isTestPath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll("\\", "/");
  const fileName = path.basename(normalized);
  return normalized.startsWith("tests/") || fileName.startsWith("test_") || fileName.endsWith("_test.py");
}
