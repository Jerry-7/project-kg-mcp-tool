# project-kg

`project-kg` is a TypeScript/Node.js MCP server that indexes Python projects and generates diagrams (Mermaid or draw.io) for agent-assisted code reading.

## MVP Scope

- Build a static `.project-kg/` index for Python projects.
- Extract Python files, imports, classes, functions, methods, parameters, return annotations, decorators, and simple call expressions.
- Generate three diagram modes in Mermaid (default) or draw.io format:
  - `core_modules`: core file/module dependencies with architecture role grouping.
  - `feature_trace`: key call chain for a function, method, class, or file query.
  - `feature_flow`: annotated ordered feature flow with call/data/return edge styles.

## Commands

```sh
npm install
npm run build
npm test
npm run dev
```

## CLI

After building, `project-kg` can also be used without an MCP client:

```sh
npm run build
node dist/src/cli.js build ./my-python-app
node dist/src/cli.js overview ./my-python-app
node dist/src/cli.js trace ./my-python-app "UserService.login" --max-depth 3
node dist/src/cli.js drawio ./my-python-app --mode core_modules --format mermaid --output ./core.md
node dist/src/cli.js drawio ./my-python-app --mode feature_flow --query "UserService.login" --max-depth 3 --max-nodes 8 --format mermaid --output ./login-flow.md
```

Use `node dist/src/cli.js serve` to start the MCP stdio server from the CLI entrypoint.

## MCP Tools

- `build_project_index`: scan and index a Python project.
- `get_project_overview`: summarize entrypoints, packages, and core files from the index.
- `get_module_dependencies`: return import dependency graph data.
- `trace_feature_flow`: return a bounded function/method call chain.
- `generate_drawio`: generate a Mermaid markdown or draw.io diagram for `core_modules`, `feature_trace`, or `feature_flow`. Default format is `mermaid`.

## Index Output

The index is written to the analyzed project:

```text
.project-kg/
  project-index.json
  dependency-graph.json
  symbol-index.json
  call-graph.json
```
