# project-kg

`project-kg` is a TypeScript/Node.js MCP server that indexes Python projects and generates draw.io diagrams for agent-assisted code reading.

## MVP Scope

- Build a static `.project-kg/` index for Python projects.
- Extract Python files, imports, classes, functions, methods, parameters, return annotations, decorators, and simple call expressions.
- Generate two diagram modes:
  - `core_modules`: core file/module dependencies.
  - `feature_trace`: key call chain for a function, method, class, or file query.

## Commands

```sh
npm install
npm run build
npm test
npm run dev
```

## MCP Tools

- `build_project_index`: scan and index a Python project.
- `get_project_overview`: summarize entrypoints, packages, and core files from the index.
- `get_module_dependencies`: return import dependency graph data.
- `trace_feature_flow`: return a bounded function/method call chain.
- `generate_drawio`: write a `.drawio` diagram for `core_modules` or `feature_trace`.

## Index Output

The index is written to the analyzed project:

```text
.project-kg/
  project-index.json
  dependency-graph.json
  symbol-index.json
  call-graph.json
```
