import type { CallEdge, CallGraph } from "../types/call-graph.js";
import type { SymbolIndex } from "../types/symbol-index.js";
import type { ParsedPythonFile } from "./python-parser.js";

export function buildCallGraph(parsedFiles: ParsedPythonFile[], symbolIndex: SymbolIndex): CallGraph {
  const symbolsBySimpleName = new Map<string, string[]>();
  for (const symbol of symbolIndex.symbols) {
    const existing = symbolsBySimpleName.get(symbol.name) ?? [];
    existing.push(symbol.id);
    symbolsBySimpleName.set(symbol.name, existing);
  }

  const edges: CallEdge[] = [];
  for (const parsedFile of parsedFiles) {
    for (const call of parsedFile.calls) {
      if (!call.enclosingSymbolId) {
        continue;
      }

      const candidates = symbolsBySimpleName.get(call.calleeName) ?? [];
      const sameFileCandidate = candidates.find((id) => id.startsWith(`${call.filePath}::`));
      const target = sameFileCandidate ?? candidates[0];
      edges.push({
        from: call.enclosingSymbolId,
        to: target,
        expression: call.expression,
        calleeName: call.calleeName,
        filePath: call.filePath,
        location: call.location,
        confidence: target ? (sameFileCandidate ? "medium" : "low") : "low"
      });
    }
  }

  return {
    schemaVersion: 1,
    edges
  };
}
