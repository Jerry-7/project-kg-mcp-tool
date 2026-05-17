# Development Status

Date: 2026-05-15

## Current Goal

Improve `project-kg` feature-flow diagrams so agents can produce readable draw.io files with annotations, call order, bounded node counts, and visible data input/output direction instead of dense static call graphs.

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
- Flow-oriented feature reading: trace a requested feature, annotate nodes and edges with source context, show call order and data movement, and output a readable flow diagram that separates main path, branch calls, inputs, and returns.

The long-term quality target is that an agent can use this MCP server as a project-reading backend: first build reliable indexes, then answer structural questions, then produce visual diagrams that make both the whole project and specific implementation flows easier to understand.

## Confirmed MVP Scope

- Implementation language: TypeScript + Node.js.
- Target analysis language: Python.
- Parser: `tree-sitter` + `tree-sitter-python`.
- Index output directory in analyzed projects: `.project-kg/`.
- Diagram modes:
  - `core_modules`: core Python module dependency diagram.
  - `feature_trace`: bounded function/method call-chain diagram.
  - `feature_flow`: annotated ordered flow diagram with call/data/return semantics.

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
- CLI entrypoint in `src/cli.ts` for manually running indexing, overview, dependency graph, feature tracing, draw.io generation, and MCP stdio serving outside an MCP client.
- `project-kg` package bin now points to the built CLI entrypoint at `dist/src/cli.js`.
- README now documents basic CLI usage.
- `generate_drawio` now supports `feature_flow` mode with flow controls for depth, node count, branches, returns, data flow, and detail level.
- draw.io writer now renders feature-flow diagrams with horizontal main-path layout, legend, annotations, and distinct edge styles for calls, branches, data input, data output, and returns.

## Latest Session Progress

- Recorded the next product-quality gap: generated feature diagrams are currently too dense and lack annotations, call order, and data input/output semantics.
- Decided the primary fix belongs in the tool/index/model/rendering layers, with agent prompting and `SKILL.md` guidance as a secondary control.
- Planned a staged upgrade from `feature_trace` static call graphs toward an annotated, bounded `feature_flow` diagram mode.
- Completed Phase 1 metadata groundwork:
  - `SymbolNode` now supports optional `docstring` and `leadingComment`.
  - `CallEdge` now supports optional `sequence`, `arguments`, `assignmentTarget`, `returnExpression`, and `receiver`.
  - Python parser now extracts docstrings, leading comments, call arguments, receiver names, assignment targets, return-expression context, and per-symbol call order.
  - Call graph generation now preserves the new flow metadata in `call-graph.json`.
  - Parser and index integration tests now cover the new metadata fields.
- Completed the first Phase 2 trace-model slice:
  - Added `FeatureFlow`, `FeatureFlowStep`, `FeatureFlowEdge`, `FeatureFlowOptions`, and edge kinds for `call`, `branch`, `data_in`, `data_out`, and `return`.
  - Added `traceFeatureFlow` alongside the existing `traceFeature` so old feature-trace behavior remains available.
  - `traceFeatureFlow` now builds ordered steps, main-path call edges, optional branch inclusion, node annotations from docstrings/comments, and data-in/data-out/return edges from Phase 1 metadata.
  - Added tests for default flow options, node annotations, sequence labels, data-in/data-out edges, and `includeDataFlow: false`.
- Completed the first Phase 3 rendering/tooling slice:
  - Added `feature_flow` to diagram modes and `generate_drawio`.
  - Added `buildFeatureFlowDiagram` to convert `FeatureFlow` into a draw.io model.
  - Added flow-specific draw.io layout, legend rendering, node styles, and edge styles.
  - Exposed flow controls in MCP tool schema and CLI drawio options.
  - Updated README and `SKILL.md` to recommend `feature_flow` for user-facing feature diagrams.
- Added Mermaid format as the default diagram output mode alongside draw.io:
  - Created `src/core/mermaid-writer.ts` that converts `DiagramModel` to Mermaid `flowchart LR` markdown.
  - `core_modules` diagrams use subgraphs with architecture role grouping and color classDefs.
  - `feature_flow` / `feature_trace` diagrams use flat node list with styled edges: solid for calls, dashed for data/branch, dotted for return.
  - Legend rendered as a Mermaid subgraph with edge-style symbols.
  - Added `format` parameter (`"mermaid"` | `"drawio"`) to `generate_drawio` tool schema, defaulting to `"mermaid"`.
  - Mermaid response includes `content` field so agents can render diagrams inline without users opening a file.
  - Added `--format` CLI option for the `drawio` command.
  - Updated `SKILL.md` agent rules to prefer Mermaid for inline rendering and draw.io only when manual editing is needed.
  - Updated README to document Mermaid support.
  - Added tests for mermaid output for `core_modules`, `feature_flow`, and default format.
- Added a reusable command-line interface with commands:
  - `serve`
  - `build`
  - `overview`
  - `deps`
  - `trace`
  - `drawio`
- Reused existing tool handlers from the CLI so MCP behavior and manual behavior stay aligned.
- Added CLI argument parsing coverage for build, deps, trace, drawio, and invalid arguments.
- Updated `package.json` and `package-lock.json` so the package binary points to the actual compiled CLI file.
- Documented the CLI workflow in `README.md`.
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
node dist/src/cli.js --help
node dist/src/cli.js build .\tmp-cli-project
node dist/src/cli.js overview .\tmp-cli-project
node dist/src/cli.js deps .\tmp-cli-project
node dist/src/cli.js trace .\tmp-cli-project UserService.login --max-depth 3
node dist/src/cli.js drawio .\tmp-cli-project --mode core_modules --output .\tmp-cli-project\diagrams\core.drawio
```

Test result: 6 test files passed, 11 tests passed.
Latest test result after `feature_flow`: 6 test files passed, 13 tests passed.
Latest test result after Mermaid support: 6 test files passed, 16 tests passed.

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
- `feature_trace` diagrams are call-relationship diagrams without data-flow annotations. Use `feature_flow` mode instead for annotated flow diagrams.
- draw.io layout supports role-grouped architecture columns for `core_modules` and horizontal flow layout for feature flows, but layout is not dependency-aware within each layer.
- Mermaid output relies on the Mermaid renderer's built-in dagre layout, which may not always produce optimal node positioning for large graphs. draw.io format remains available for manual tuning.

## Planned Feature-Flow Diagram Upgrade

Goal: make feature diagrams explain how a requested feature runs, what data enters each step, what data leaves, and in what order the main calls happen.

### Phase 1: Enrich extracted Python metadata

- Status: completed for docstrings, leading comments, call source line, call order, callee text, argument text, receiver, assignment target, and surrounding return-expression context when statically visible.
- Backward compatibility preserved by adding optional fields instead of removing current fields.
- Tests cover fixture code with arguments, assignments, returns, docstrings, and leading comments.

### Phase 2: Upgrade trace model

- Status: initial trace-model slice completed.
- Added flow-oriented trace data alongside existing `FeatureTrace`:
  - ordered steps
  - main-path edges
  - branch/helper edge kind
  - edge kind: `call`, `branch`, `data_in`, `data_out`, `return`
  - sequence numbers
  - node annotations from signature, docstring/comment, file path, and source line
- Added trace controls in core model:
  - `maxDepth`
  - `maxNodes`
  - `includeBranches`
  - `includeReturns`
  - `includeDataFlow`
  - `detailLevel`
- Remaining Phase 2 work: expose these controls through MCP schemas and CLI inputs, and add richer branch/helper fixtures.

### Phase 3: Improve draw.io rendering

- Status: initial rendering/tooling slice completed.
- Feature-flow diagrams render ordered left-to-right flows for the main path.
- Main arrows are labeled with sequence numbers and call names.
- Distinct edge styles are supported:
  - solid dark edge for calls
  - blue edge for data input
  - green dashed edge for return/data output
  - gray edge for branch/helper calls
- Diagram legend is rendered for feature-flow diagrams.
- Default diagrams are bounded and readable by showing the main path first and placing optional branches to the side.
- Remaining Phase 3 work: add richer branch layout tests and tune draw.io geometry for larger traces.

### Phase 4: Update agent workflow guidance

- Status: initial update completed.
- `SKILL.md` now tells agents to prefer focused `feature_flow` diagrams over large all-node traces.
- Instruct agents to use conservative defaults such as small `maxDepth`, bounded `maxNodes`, and `includeBranches: false` unless the user asks for exhaustive details.
- Require agents to inspect trace matches before generating a diagram and to explain ambiguity when multiple roots are plausible.
- Document that prompt guidance cannot recover data-flow details unless the tool extracts them; prompts should steer tool options, not replace structured analysis.

## Suggested Next Steps

1. Add richer fixtures for branching, helper calls, direct returns, and multi-step data flow.
2. Tune Mermaid legend to use actual styled edges instead of text symbols, if Mermaid supports edge-in-subgraph.
3. Add explicit `trace_feature_flow` MCP response support for the new `FeatureFlow` model (currently uses `traceFeature` in MCP path).
4. Add MCP client configuration examples to README.
5. Later: improve `core_modules` dependency-aware positioning within each architecture layer.
6. Later: consider removing `feature_trace` mode in favor of `feature_flow` with conservative defaults.

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
- `src/types/call-graph.ts`: call graph and feature trace schemas to extend with optional flow metadata.
- `src/tools/trace-feature-flow.ts`: MCP trace input schema to extend with flow controls.
- `src/core/mermaid-writer.ts`: Mermaid flowchart markdown rendering from DiagramModel.
- `src/tools/generate-drawio.ts`: diagram mode schema and tool handler with drawio/mermaid dispatch.
