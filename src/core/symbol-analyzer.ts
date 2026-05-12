import type { SymbolIndex } from "../types/symbol-index.js";
import type { ParsedPythonFile } from "./python-parser.js";

export function buildSymbolIndex(parsedFiles: ParsedPythonFile[]): SymbolIndex {
  return {
    schemaVersion: 1,
    symbols: parsedFiles.flatMap((file) => file.symbols).sort((a, b) => a.id.localeCompare(b.id))
  };
}
