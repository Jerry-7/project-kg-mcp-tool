---
name: project-kg-reader
description: Use the project-kg MCP server or CLI to read Python codebases, build reusable .project-kg indexes, inspect project architecture, trace feature/function/method/class call flows, and generate draw.io diagrams for overall architecture or focused method chains. Use when the user asks an agent to understand a Python project, explain module dependencies, trace a feature, or output editable .drawio files.
---

# Project KG Reader

Use `project-kg` as a code-reading backend for Python projects. The normal flow is:

1. Build `.project-kg/` indexes for the target project.
2. Read the generated overview, dependency graph, symbol index, and call graph through MCP tools.
3. Generate `.drawio` diagrams for project architecture or annotated feature flows.

Do not assume indexes already exist. Call `build_project_index` before reading `.project-kg/` unless the user explicitly says the index is current.

## MCP Server Setup

If the MCP server is not already configured, build this repository first:

```sh
npm install
npm run build
```

Recommended stdio MCP configuration:

```json
{
  "mcpServers": {
    "project-kg": {
      "command": "node",
      "args": [
        "E:\\project\\mcp-tools\\project-kg\\dist\\src\\cli.js",
        "serve"
      ]
    }
  }
}
```

Development alternative:

```json
{
  "mcpServers": {
    "project-kg": {
      "command": "npm.cmd",
      "args": ["run", "dev"],
      "cwd": "E:\\project\\mcp-tools\\project-kg"
    }
  }
}
```

Prefer `node dist/src/cli.js serve` after build because it uses the packaged CLI entrypoint.

## Required Tool Order

Use this sequence for most project-reading tasks:

1. `build_project_index`
2. `get_project_overview`
3. `get_module_dependencies` when module/import relationships matter
4. `trace_feature_flow` when the user asks about a feature, function, method, class, or file flow
5. `generate_drawio` when the user asks for a visual artifact. Prefer `feature_flow` over `feature_trace` for user-facing feature diagrams.

Generated indexes are written inside the analyzed Python project:

```text
.project-kg/
  project-index.json
  dependency-graph.json
  symbol-index.json
  call-graph.json
```

## MCP Tools

### `build_project_index`

Scan and index a Python project.

```json
{
  "projectPath": "E:\\path\\to\\python-project",
  "maxDepth": 8
}
```

Use this before overview, dependency, trace, or draw.io tools. The result includes counts for files, symbols, dependencies, and calls.

### `get_project_overview`

Summarize the generated index.

```json
{
  "projectPath": "E:\\path\\to\\python-project"
}
```

Use the response to identify entrypoints, packages, core files, and graph sizes before explaining the project.

### `get_module_dependencies`

Read the import dependency graph.

```json
{
  "projectPath": "E:\\path\\to\\python-project",
  "includeExternal": false
}
```

Use `includeExternal: true` only when the user asks about third-party or standard-library imports.

### `trace_feature_flow`

Trace a bounded static call chain from a query.

```json
{
  "projectPath": "E:\\path\\to\\python-project",
  "query": "UserService.login",
  "maxDepth": 4
}
```

The query can be an exact qualified name, short function/method name, class name, file-path fragment, or simple natural phrase such as `user login`.

Inspect `matches` before trusting the result. If several candidates are plausible, ask the user to choose or explain the ambiguity.

### `generate_drawio`

Generate a diagram as a Mermaid markdown file or draw.io XML. Default format is `mermaid`.

Overall architecture (Mermaid):

```json
{
  "projectPath": "E:\\path\\to\\python-project",
  "mode": "core_modules",
  "format": "mermaid"
}
```

Overall architecture (draw.io for manual editing):

```json
{
  "projectPath": "E:\\path\\to\\python-project",
  "mode": "core_modules",
  "format": "drawio",
  "outputPath": "E:\\path\\to\\python-project\\project-core.drawio"
}
```

Annotated feature flow (Mermaid, inline in agent response):

```json
{
  "projectPath": "E:\\path\\to\\python-project",
  "mode": "feature_flow",
  "query": "UserService.login",
  "format": "mermaid",
  "maxDepth": 3,
  "maxNodes": 8,
  "includeBranches": false,
  "includeReturns": true,
  "includeDataFlow": true,
  "detailLevel": "summary",
  "outputPath": "E:\\path\\to\\python-project\\login-flow.md"
}
```

When `format` is `"mermaid"`, the response includes a `content` field with a markdown-fenced Mermaid block. Always include this `content` in your response so users see the diagram inline without opening a file.

If `outputPath` is omitted, the tool writes a default file (`.md` for mermaid, `.drawio` for drawio) in the analyzed project directory.

## Workflow: Overall Architecture

Use when the user asks to read a project, summarize architecture, map modules, or generate a project diagram.

1. Call `build_project_index`.
2. Call `get_project_overview`.
3. Optionally call `get_module_dependencies` with `includeExternal: false`.
4. Call `generate_drawio` with `mode: "core_modules"` if the user wants a file.
5. Report the output path and summarize the main entrypoints, layers, and dependencies.

`core_modules` diagrams classify files into roles such as entrypoint, interface, service, domain, repository, model, package, and module.

## Workflow: Feature Or Method Chain

Use when the user asks how a feature works, asks for a call flow, or names a function, method, class, or file.

1. Call `build_project_index` unless the index is already current.
2. Call `trace_feature_flow` with the user's query.
3. Inspect `rootSymbolId`, `matches`, `steps`, and `edges`.
4. If no match is found, say so and suggest a more specific function, method, class, or file-path query.
5. If the match is acceptable and the user wants a diagram, call `generate_drawio` with `mode: "feature_flow"` and the same query.
6. Report the output path and summarize the root method plus the main downstream calls.

## CLI Fallback

If MCP tools are unavailable but shell access exists, use the CLI after building:

```sh
node dist/src/cli.js build E:\path\to\python-project
node dist/src/cli.js overview E:\path\to\python-project
node dist/src/cli.js deps E:\path\to\python-project
node dist/src/cli.js trace E:\path\to\python-project "UserService.login" --max-depth 4
node dist/src/cli.js drawio E:\path\to\python-project --mode core_modules --format mermaid --output E:\path\to\python-project\project-core.md
node dist/src/cli.js drawio E:\path\to\python-project --mode feature_flow --query "UserService.login" --max-depth 3 --max-nodes 8 --format mermaid --output E:\path\to\python-project\login-flow.md
```

## Agent Rules

- Prefer absolute `projectPath` values.
- Keep generated indexes in the analyzed project under `.project-kg/`.
- Avoid scanning ignored directories such as `.git/`, `.venv/`, `__pycache__/`, `node_modules/`, `dist/`, and `.project-kg/`.
- Do not edit the analyzed Python project except for requested `.project-kg/` indexes or `.drawio` outputs.
- Treat import and call resolution as static approximations, not full Python runtime behavior.
- When a trace query is ambiguous, use `matches` to present candidates or choose only when the strongest match is obvious.
- Keep feature-flow diagrams focused by default: use small `maxDepth`, bounded `maxNodes`, and `includeBranches: false` unless the user asks for exhaustive details.
- Prefer `format: "mermaid"` so the diagram renders inline in the agent response. Only use `format: "drawio"` when the user explicitly wants to edit the diagram manually.
- When the response includes a Mermaid `content` field, render it as a code block so the user sees the diagram immediately.
- In the final response, include the generated diagram path and a concise explanation of what the diagram contains.

## Common Requests

User:

```text
Read this Python project and draw the overall architecture.
```

Do:

1. `build_project_index`
2. `get_project_overview`
3. `generate_drawio` with `mode: "core_modules"`

User:

```text
Draw the login flow.
```

Do:

1. `build_project_index`
2. `trace_feature_flow` with `query: "login"` or the user's exact phrase
3. Check `matches`
4. `generate_drawio` with `mode: "feature_flow"`

User:

```text
Trace UserService.login and output draw.io.
```

Do:

1. `build_project_index`
2. `trace_feature_flow` with `query: "UserService.login"`
3. `generate_drawio` with `mode: "feature_flow"` and `query: "UserService.login"`
