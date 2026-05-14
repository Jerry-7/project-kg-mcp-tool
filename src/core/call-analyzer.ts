import type { CallEdge, CallGraph } from "../types/call-graph.js";
import type { SymbolIndex, SymbolNode } from "../types/symbol-index.js";
import type { ParsedPythonFile, PythonAssignmentInfo, PythonCallInfo } from "./python-parser.js";

export function buildCallGraph(parsedFiles: ParsedPythonFile[], symbolIndex: SymbolIndex): CallGraph {
  const symbolsBySimpleName = new Map<string, string[]>();
  const methodSymbolsByClassAndName = new Map<string, SymbolNode[]>();
  for (const symbol of symbolIndex.symbols) {
    const existing = symbolsBySimpleName.get(symbol.name) ?? [];
    existing.push(symbol.id);
    symbolsBySimpleName.set(symbol.name, existing);

    if (symbol.kind === "method") {
      const className = symbol.qualifiedName.split(".").at(-2);
      if (className) {
        const key = methodKey(className, symbol.name);
        const existingMethods = methodSymbolsByClassAndName.get(key) ?? [];
        existingMethods.push(symbol);
        methodSymbolsByClassAndName.set(key, existingMethods);
      }
    }
  }

  const inferredTypes = buildInferredTypes(parsedFiles);
  const edges: CallEdge[] = [];
  for (const parsedFile of parsedFiles) {
    for (const call of parsedFile.calls) {
      if (!call.enclosingSymbolId) {
        continue;
      }

      const resolvedTypedCall = resolveTypedCall(call, inferredTypes, methodSymbolsByClassAndName);
      const candidates = symbolsBySimpleName.get(call.calleeName) ?? [];
      const sameFileCandidate = candidates.find((id) => id.startsWith(`${call.filePath}::`));
      const target = resolvedTypedCall?.id ?? sameFileCandidate ?? candidates[0];
      edges.push({
        from: call.enclosingSymbolId,
        to: target,
        expression: call.expression,
        calleeName: call.calleeName,
        filePath: call.filePath,
        location: call.location,
        confidence: target ? (resolvedTypedCall ? "high" : sameFileCandidate ? "medium" : "low") : "low"
      });
    }
  }

  return {
    schemaVersion: 1,
    edges
  };
}

function buildInferredTypes(parsedFiles: ParsedPythonFile[]): Map<string, string> {
  const inferredTypes = new Map<string, string>();
  for (const parsedFile of parsedFiles) {
    for (const assignment of parsedFile.assignments) {
      if (!assignment.enclosingSymbolId) {
        continue;
      }

      inferredTypes.set(localAssignmentKey(assignment), assignment.valueName);

      const className = enclosingClassName(assignment.enclosingSymbolId);
      if (className && assignment.target.startsWith("self.")) {
        inferredTypes.set(classAssignmentKey(assignment.filePath, className, assignment.target), assignment.valueName);
      }
    }
  }

  return inferredTypes;
}

function resolveTypedCall(
  call: PythonCallInfo,
  inferredTypes: Map<string, string>,
  methodSymbolsByClassAndName: Map<string, SymbolNode[]>
): SymbolNode | undefined {
  if (call.calleePath.length < 2 || !call.enclosingSymbolId) {
    return undefined;
  }

  const receiver = call.calleePath.slice(0, -1).join(".");
  const methodName = call.calleeName;
  const className =
    inferredTypes.get(`${call.filePath}::${call.enclosingSymbolId}::${receiver}`) ??
    inferredClassFieldType(call, receiver, inferredTypes);
  if (!className) {
    return undefined;
  }

  const candidates = methodSymbolsByClassAndName.get(methodKey(className, methodName)) ?? [];
  return (
    candidates.find((symbol) => symbol.filePath === call.filePath) ??
    candidates.find((symbol) => symbol.filePath !== call.filePath) ??
    candidates[0]
  );
}

function inferredClassFieldType(call: PythonCallInfo, receiver: string, inferredTypes: Map<string, string>): string | undefined {
  const className = enclosingClassName(call.enclosingSymbolId);
  if (!className || !receiver.startsWith("self.")) {
    return undefined;
  }

  return inferredTypes.get(classAssignmentKey(call.filePath, className, receiver));
}

function localAssignmentKey(assignment: PythonAssignmentInfo): string {
  return `${assignment.filePath}::${assignment.enclosingSymbolId}::${assignment.target}`;
}

function classAssignmentKey(filePath: string, className: string, target: string): string {
  return `${filePath}::${className}::${target}`;
}

function methodKey(className: string, methodName: string): string {
  return `${className}.${methodName}`;
}

function enclosingClassName(symbolId: string | undefined): string | undefined {
  const qualifiedName = symbolId?.split("::").at(1);
  if (!qualifiedName?.includes(".")) {
    return undefined;
  }

  return qualifiedName.split(".").at(-2);
}
