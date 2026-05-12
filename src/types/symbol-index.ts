export type SymbolKind = "class" | "function" | "method";

export interface SymbolParam {
  name: string;
  annotation?: string;
  defaultValue?: string;
}

export interface SourceLocation {
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

export interface SymbolNode {
  id: string;
  kind: SymbolKind;
  name: string;
  qualifiedName: string;
  filePath: string;
  params: SymbolParam[];
  returnType?: string;
  decorators: string[];
  location: SourceLocation;
}

export interface SymbolIndex {
  schemaVersion: 1;
  symbols: SymbolNode[];
}
