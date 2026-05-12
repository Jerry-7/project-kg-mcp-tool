import path from "node:path";

const ignoredDirectories = new Set([
  ".git",
  ".hg",
  ".svn",
  ".idea",
  ".vscode",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  ".tox",
  ".venv",
  "venv",
  "env",
  "__pycache__",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".project-kg"
]);

const ignoredFileSuffixes = [".pyc", ".pyo", ".so", ".dll", ".dylib", ".log"];

export function shouldIgnorePath(relativePath: string): boolean {
  const parts = relativePath.split(/[\\/]+/).filter(Boolean);
  if (parts.some((part) => ignoredDirectories.has(part))) {
    return true;
  }

  return ignoredFileSuffixes.some((suffix) => relativePath.endsWith(suffix));
}

export function toProjectRelative(rootPath: string, absolutePath: string): string {
  return path.relative(rootPath, absolutePath).replaceAll(path.sep, "/");
}
