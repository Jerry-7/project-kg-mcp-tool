import { readFile } from "node:fs/promises";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { SourceLocation, SymbolNode, SymbolParam } from "../types/symbol-index.js";

export interface PythonImportInfo {
  filePath: string;
  module: string;
  imported: string[];
  isFromImport: boolean;
}

export interface PythonCallInfo {
  filePath: string;
  enclosingSymbolId?: string;
  calleeName: string;
  calleePath: string[];
  expression: string;
  location: SourceLocation;
  sequence?: number;
  arguments: string[];
  assignmentTarget?: string;
  returnExpression?: string;
  receiver?: string;
}

export interface PythonAssignmentInfo {
  filePath: string;
  enclosingSymbolId?: string;
  target: string;
  valueName: string;
  expression: string;
  location: SourceLocation;
}

export interface ParsedPythonFile {
  filePath: string;
  imports: PythonImportInfo[];
  symbols: SymbolNode[];
  calls: PythonCallInfo[];
  assignments: PythonAssignmentInfo[];
}

const parser = new Parser();
parser.setLanguage(Python);

export async function parsePythonFile(absolutePath: string, relativePath: string): Promise<ParsedPythonFile> {
  const source = await readFile(absolutePath, "utf8");
  const tree = parser.parse(source);
  const imports: PythonImportInfo[] = [];
  const symbols: SymbolNode[] = [];
  const calls: PythonCallInfo[] = [];
  const assignments: PythonAssignmentInfo[] = [];
  const callSequencesBySymbol = new Map<string, number>();

  visit(tree.rootNode, [], undefined);

  return { filePath: relativePath, imports, symbols, calls, assignments };

  function visit(node: Parser.SyntaxNode, classStack: string[], enclosingSymbolId: string | undefined): void {
    if (node.type === "import_statement" || node.type === "import_from_statement") {
      const parsedImport = parseImportNode(node, source, relativePath);
      if (parsedImport) {
        imports.push(parsedImport);
      }
    }

    if (node.type === "class_definition") {
      const className = childText(node, "name", source);
      if (className) {
        const symbol = createSymbol(node, source, relativePath, "class", className, classStack, source);
        symbols.push(symbol);
        for (const child of node.namedChildren) {
          visit(child, [...classStack, className], symbol.id);
        }
        return;
      }
    }

    if (node.type === "function_definition") {
      const functionName = childText(node, "name", source);
      if (functionName) {
        const kind = classStack.length > 0 ? "method" : "function";
        const symbol = createSymbol(node, source, relativePath, kind, functionName, classStack, source);
        symbols.push(symbol);
        for (const child of node.namedChildren) {
          visit(child, classStack, symbol.id);
        }
        return;
      }
    }

    if (node.type === "assignment") {
      const parsedAssignment = parseAssignmentNode(node, relativePath, enclosingSymbolId);
      if (parsedAssignment) {
        assignments.push(parsedAssignment);
      }
    }

    if (node.type === "call") {
      const functionNode = node.childForFieldName("function");
      const calleePath = functionNode ? splitDottedName(functionNode.text) : [];
      const calleeName = calleePath.at(-1);
      if (calleeName) {
        const sequence = enclosingSymbolId ? nextCallSequence(callSequencesBySymbol, enclosingSymbolId) : undefined;
        calls.push({
          filePath: relativePath,
          enclosingSymbolId,
          calleeName,
          calleePath,
          expression: node.text,
          location: toLocation(node),
          sequence,
          arguments: parseCallArguments(node),
          assignmentTarget: assignmentTargetForCall(node),
          returnExpression: returnExpressionForCall(node),
          receiver: calleePath.length > 1 ? calleePath.slice(0, -1).join(".") : undefined
        });
      }
    }

    for (const child of node.namedChildren) {
      visit(child, classStack, enclosingSymbolId);
    }
  }
}

function parseAssignmentNode(
  node: Parser.SyntaxNode,
  filePath: string,
  enclosingSymbolId: string | undefined
): PythonAssignmentInfo | undefined {
  const leftNode = node.childForFieldName("left");
  const rightNode = node.childForFieldName("right");
  if (!leftNode || !rightNode || rightNode.type !== "call") {
    return undefined;
  }

  const functionNode = rightNode.childForFieldName("function");
  const valueName = functionNode ? splitDottedName(functionNode.text).at(-1) : undefined;
  if (!valueName) {
    return undefined;
  }

  return {
    filePath,
    enclosingSymbolId,
    target: leftNode.text,
    valueName,
    expression: node.text,
    location: toLocation(node)
  };
}

function parseImportNode(
  node: Parser.SyntaxNode,
  source: string,
  filePath: string
): PythonImportInfo | undefined {
  const text = node.text.trim();
  if (node.type === "import_statement") {
    const imported = text
      .replace(/^import\s+/, "")
      .split(",")
      .map((part) => part.trim().split(/\s+as\s+/)[0])
      .filter(Boolean);
    return {
      filePath,
      module: imported[0] ?? "",
      imported,
      isFromImport: false
    };
  }

  const moduleName = childText(node, "module_name", source) ?? text.match(/^from\s+(.+?)\s+import\s+/)?.[1];
  const importPart = text.match(/\simport\s+(.+)$/)?.[1] ?? "";
  const imported = importPart
    .split(",")
    .map((part) => part.trim().split(/\s+as\s+/)[0])
    .filter(Boolean);

  if (!moduleName) {
    return undefined;
  }

  return {
    filePath,
    module: moduleName,
    imported,
    isFromImport: true
  };
}

function createSymbol(
  node: Parser.SyntaxNode,
  source: string,
  filePath: string,
  kind: SymbolNode["kind"],
  name: string,
  classStack: string[],
  fullSource: string
): SymbolNode {
  const qualifiedName = [...classStack, name].join(".");
  return {
    id: `${filePath}::${qualifiedName}`,
    kind,
    name,
    qualifiedName,
    filePath,
    params: kind === "class" ? [] : parseParams(node, source),
    returnType: kind === "class" ? undefined : parseReturnType(node, source),
    decorators: parseDecorators(node),
    docstring: parseDocstring(node),
    leadingComment: parseLeadingComment(node, fullSource),
    location: toLocation(node)
  };
}

function parseParams(node: Parser.SyntaxNode, source: string): SymbolParam[] {
  const parameters = node.childForFieldName("parameters");
  if (!parameters) {
    return [];
  }

  return parameters.namedChildren
    .map((child) => parseParam(child, source))
    .filter((param): param is SymbolParam => Boolean(param));
}

function parseParam(node: Parser.SyntaxNode, source: string): SymbolParam | undefined {
  const nameNode = node.type === "identifier" ? node : node.childForFieldName("name");
  if (!nameNode) {
    return undefined;
  }

  const annotationNode = node.childForFieldName("type");
  const defaultNode = node.childForFieldName("value");
  return {
    name: source.slice(nameNode.startIndex, nameNode.endIndex),
    annotation: annotationNode ? source.slice(annotationNode.startIndex, annotationNode.endIndex) : undefined,
    defaultValue: defaultNode ? source.slice(defaultNode.startIndex, defaultNode.endIndex) : undefined
  };
}

function parseReturnType(node: Parser.SyntaxNode, source: string): string | undefined {
  const returnType = node.childForFieldName("return_type");
  return returnType ? source.slice(returnType.startIndex, returnType.endIndex).replace(/^->\s*/, "") : undefined;
}

function parseDecorators(node: Parser.SyntaxNode): string[] {
  const parent = node.parent;
  if (!parent || parent.type !== "decorated_definition") {
    return [];
  }

  return parent.namedChildren
    .filter((child) => child.type === "decorator")
    .map((child) => child.text.replace(/^@/, "").trim());
}

function parseDocstring(node: Parser.SyntaxNode): string | undefined {
  const body = node.childForFieldName("body");
  const firstStatement = body?.namedChildren[0];
  const expression = firstStatement?.type === "expression_statement" ? firstStatement.namedChildren[0] : undefined;
  if (!expression || expression.type !== "string") {
    return undefined;
  }

  return cleanPythonStringLiteral(expression.text);
}

function parseLeadingComment(node: Parser.SyntaxNode, source: string): string | undefined {
  const lines = source.split(/\r?\n/);
  const comments: string[] = [];

  for (let lineIndex = node.startPosition.row - 1; lineIndex >= 0; lineIndex -= 1) {
    const line = lines[lineIndex]?.trim();
    if (!line) {
      if (comments.length > 0) {
        break;
      }
      continue;
    }

    if (!line.startsWith("#")) {
      break;
    }

    comments.unshift(line.replace(/^#+\s?/, "").trim());
  }

  return comments.length > 0 ? comments.join("\n") : undefined;
}

function cleanPythonStringLiteral(value: string): string {
  const trimmed = value.trim();
  const quoteMatch = trimmed.match(/^(?<prefix>[rRuUbBfF]*)?(?<quote>"""|'''|"|')(?<body>[\s\S]*)(\k<quote>)$/);
  const body = quoteMatch?.groups?.body ?? trimmed;
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

function parseCallArguments(node: Parser.SyntaxNode): string[] {
  const argumentsNode = node.childForFieldName("arguments");
  if (!argumentsNode) {
    return [];
  }

  return argumentsNode.namedChildren.map((child) => child.text.trim()).filter(Boolean);
}

function assignmentTargetForCall(node: Parser.SyntaxNode): string | undefined {
  const parent = node.parent;
  const rightNode = parent?.childForFieldName("right");
  if (parent?.type !== "assignment" || !rightNode || !sameNodeRange(rightNode, node)) {
    return undefined;
  }

  return parent.childForFieldName("left")?.text;
}

function returnExpressionForCall(node: Parser.SyntaxNode): string | undefined {
  const returnNode = nearestParentOfType(node, "return_statement");
  return returnNode?.text.replace(/^return\s+/, "").trim();
}

function nearestParentOfType(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | undefined {
  let current = node.parent;
  while (current) {
    if (current.type === type) {
      return current;
    }
    if (current.type === "function_definition" || current.type === "class_definition") {
      return undefined;
    }
    current = current.parent;
  }
  return undefined;
}

function nextCallSequence(sequences: Map<string, number>, symbolId: string): number {
  const next = (sequences.get(symbolId) ?? 0) + 1;
  sequences.set(symbolId, next);
  return next;
}

function sameNodeRange(left: Parser.SyntaxNode, right: Parser.SyntaxNode): boolean {
  return left.startIndex === right.startIndex && left.endIndex === right.endIndex;
}

function childText(node: Parser.SyntaxNode, fieldName: string, source: string): string | undefined {
  const child = node.childForFieldName(fieldName);
  return child ? source.slice(child.startIndex, child.endIndex) : undefined;
}

function splitDottedName(text: string): string[] {
  return text
    .trim()
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
}

function toLocation(node: Parser.SyntaxNode): SourceLocation {
  return {
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    startColumn: node.startPosition.column,
    endColumn: node.endPosition.column
  };
}
