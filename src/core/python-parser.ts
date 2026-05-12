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
  expression: string;
  location: SourceLocation;
}

export interface ParsedPythonFile {
  filePath: string;
  imports: PythonImportInfo[];
  symbols: SymbolNode[];
  calls: PythonCallInfo[];
}

const parser = new Parser();
parser.setLanguage(Python);

export async function parsePythonFile(absolutePath: string, relativePath: string): Promise<ParsedPythonFile> {
  const source = await readFile(absolutePath, "utf8");
  const tree = parser.parse(source);
  const imports: PythonImportInfo[] = [];
  const symbols: SymbolNode[] = [];
  const calls: PythonCallInfo[] = [];

  visit(tree.rootNode, [], undefined);

  return { filePath: relativePath, imports, symbols, calls };

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
        const symbol = createSymbol(node, source, relativePath, "class", className, classStack);
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
        const symbol = createSymbol(node, source, relativePath, kind, functionName, classStack);
        symbols.push(symbol);
        for (const child of node.namedChildren) {
          visit(child, classStack, symbol.id);
        }
        return;
      }
    }

    if (node.type === "call") {
      const functionNode = node.childForFieldName("function");
      const calleeName = functionNode ? simplifyCallee(functionNode.text) : undefined;
      if (calleeName) {
        calls.push({
          filePath: relativePath,
          enclosingSymbolId,
          calleeName,
          expression: node.text,
          location: toLocation(node)
        });
      }
    }

    for (const child of node.namedChildren) {
      visit(child, classStack, enclosingSymbolId);
    }
  }
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
  classStack: string[]
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

function childText(node: Parser.SyntaxNode, fieldName: string, source: string): string | undefined {
  const child = node.childForFieldName(fieldName);
  return child ? source.slice(child.startIndex, child.endIndex) : undefined;
}

function simplifyCallee(text: string): string {
  return text.trim().split(".").at(-1) ?? text.trim();
}

function toLocation(node: Parser.SyntaxNode): SourceLocation {
  return {
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    startColumn: node.startPosition.column,
    endColumn: node.endPosition.column
  };
}
