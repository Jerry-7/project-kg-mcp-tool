# Development Status

Date: 2026-05-14

## Current Goal

Build a TypeScript/Node.js MCP server that analyzes Python projects, generates reusable static indexes under `.project-kg/`, and produces draw.io diagrams for agents helping users understand project structure and feature call flows.

## Ultimate Goal

The final goal is to make `project-kg` an MCP tool that lets users read and understand a codebase through an agent.

The expected user experience is:

1. A user asks an agent to read a Python project.
2. The agent calls `build_project_index` to scan the project and generate reusable `.project-kg/` indexes.
3. The agent uses the generated indexes to understand the project structure, entrypoints, packages, modules, dependencies, symbols, and call relationships without repeatedly rescanning the whole codebase.
4. When the user wants a high-level understanding, the agent generates an overall project architecture diagram as a draw.io file.
5. When the user asks about a specific feature, business process, function, method, class, or file, the agent traces the relevant core method chain and generates a focused draw.io call-flow diagram.
6. The final output should be a `.drawio` file that the user can open, inspect, edit, and share.

The tool should support two primary diagram workflows:

- Overall architecture reading: build an index, summarize the project, identify core modules and dependencies, and output a `core_modules` draw.io architecture diagram.
- Core method-chain tracing: locate the user's requested feature or method, build a bounded call chain from the static call graph, and output a `feature_trace` draw.io diagram.

The long-term quality target is that an agent can use this MCP server as a project-reading backend: first build reliable indexes, then answer structural questions, then produce visual diagrams that make both the whole project and specific implementation flows easier to understand.

## Confirmed MVP Scope

- Implementation language: TypeScript + Node.js.
- Target analysis language: Python.
- Parser: `tree-sitter` + `tree-sitter-python`.
- Index output directory in analyzed projects: `.project-kg/`.
- Diagram modes:
  - `core_modules`: core Python module dependency diagram.
  - `feature_trace`: bounded function/method call-chain diagram.

## Implemented

- Project scaffolding with `package.json`, `tsconfig.json`, `README.md`, `.gitignore`, and updated `AGENTS.md`.
- Agent-facing `SKILL.md` documenting how to use the MCP tools to read Python projects and generate draw.io diagrams.
- MCP server entrypoint in `src/index.ts` and server wiring in `src/mcp/`.
- Tool handlers:
  - `build_project_index`
  - `get_project_overview`
  - `get_module_dependencies`
  - `trace_feature_flow`
  - `generate_drawio`
- Core modules:
  - filesystem scanning and ignore rules
  - Python parsing
  - dependency graph generation with package-root and `from module import symbol` candidates
  - symbol index generation
  - call graph generation with simple constructor-assignment type inference
  - feature trace graph building with scored root-symbol matches
  - draw.io XML rendering with architecture role styling and grouped layout
  - index read/write storage
- Type definitions for project index, dependency graph, symbol index, call graph, and draw.io model.
- Minimal Python fixture under `tests/fixtures/simple-python-project/`.
- Unit tests for scanner, parser, and draw.io rendering.
- Integration test for end-to-end index build, dependency graph resolution, call graph resolution, and feature trace.
- Integration tests for `generate_drawio` covering real `.drawio` file output for both `core_modules` and `feature_trace`.
- draw.io writer now creates parent output directories when needed.
- `core_modules` diagrams now classify modules into architecture roles such as entrypoint, interface, service, domain, repository, model, package, and module.
- `core_modules` draw.io output now includes grouped column headers and role-specific node styling.
- `feature_trace` now returns scored match candidates, supports short method names such as `login`, and can match tokenized natural queries such as `user login`.

## Latest Session Progress

- Added the full ultimate product goal to this status document: `project-kg` should act as an MCP backend for agents to read Python projects, build reusable indexes, and generate draw.io diagrams for both overall architecture and core method chains.
- Added integration coverage for `generate_drawio` so both `core_modules` and `feature_trace` modes are verified against real `.drawio` file output.
- Updated the draw.io writer to create parent output directories automatically.
- Improved `core_modules` diagrams from a simple dependency grid into a role-grouped architecture view with columns for entrypoints, interface layer, service layer, domain/core, data access, models/schemas, packages, and other modules.
- Added grouped architecture headers and role-specific node styling to draw.io output.
- Enhanced `feature_trace` root matching with scored candidates so agents can handle exact names, short names, file-path fragments, and simple natural queries.
- Added an agent-facing `SKILL.md` that explains the intended MCP tool workflow, tool inputs, diagram modes, and agent behavior guidelines.
- Verified the TypeScript build and Vitest suite after the code changes.

## Validation

The following commands passed:

```sh
npm run build
npm test
```

Test result: 5 test files passed, 7 tests passed.

## Important Notes

- `npm install` initially failed because `tree-sitter-python@0.21.0` requires `tree-sitter@^0.21.0`.
- `package.json` was corrected to use `tree-sitter@^0.21.1`.
- `package-lock.json` and `node_modules/` now exist locally after install.
- `dist/` was generated by `npm run build` and is ignored by `.gitignore`.
- On Windows PowerShell, use `npm.cmd` if `npm.ps1` is blocked by execution policy.

## Current Limitations

- Import resolution now handles common package-root imports, `from app.x import Y`, snake_case class module names, and basic relative imports, but still does not model Python import paths as fully as the interpreter.
- Call graph resolution can infer simple constructor assignments such as `service = UserService()` and `self.repository = UserRepository()`, but does not perform full type analysis, inheritance dispatch, or data-flow tracking.
- `feature_trace` supports exact symbol queries, short names, file-path fragments, and simple tokenized natural queries, but it is still static text matching rather than semantic search.
- draw.io layout now supports role-grouped architecture columns for `core_modules`, but it is not yet dependency-aware within each layer.
- No CLI wrapper exists yet for invoking tools outside MCP.

## Suggested Next Steps

1. Improve `core_modules` dependency-aware positioning within each architecture layer.
2. Improve Python import resolution for multiple source roots, namespace packages, and re-exports from `__init__.py`.
3. Improve method-call resolution for constructor calls imported through aliases and factory functions.
4. Add a small CLI or script to manually run indexing against a sample Python project.
5. Improve natural query matching for `feature_trace` with richer semantic ranking and better ambiguous-match handling.
6. Add MCP client configuration examples to `README.md`.

## Useful Commands

```sh
npm install
npm run build
npm test
npm run dev
```

## Key Files

- `src/core/build-project-index.ts`: end-to-end index build orchestration.
- `src/core/python-parser.ts`: tree-sitter Python AST extraction.
- `src/core/dependency-analyzer.ts`: Python import dependency graph.
- `src/core/call-analyzer.ts`: simple call graph construction.
- `src/core/graph-builder.ts`: core module diagram model and feature trace.
- `src/core/drawio-writer.ts`: draw.io XML rendering.
- `src/mcp/tools.ts`: MCP tool registration and dispatch.
