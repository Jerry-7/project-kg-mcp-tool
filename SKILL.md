---
name: project-kg-reader
description: Use the project-kg MCP server to help users read Python codebases through an agent. Use when the user wants to understand a Python project, build reusable .project-kg indexes, inspect project architecture, trace a feature/function/method/class call flow, or generate draw.io files for overall architecture or core method chains.
---

# Project KG Reader

Use this skill when an agent has access to the `project-kg` MCP tools and the user wants to understand a Python project visually or structurally.

The primary goal is to build a reusable `.project-kg/` index, use it to answer project-reading questions, and generate `.drawio` files for architecture and method-chain diagrams.

## Tool Order

Always call `build_project_index` before reading `.project-kg/` data unless the user explicitly says the index is already current.

Recommended sequence:

1. Call `build_project_index` with the target Python project path.
2. Call `get_project_overview` to understand entrypoints, packages, core files, and graph counts.
3. Call `get_module_dependencies` when the user asks about module relationships or architecture.
4. Call `trace_feature_flow` when the user asks about a feature, function, method, class, or file flow.
5. Call `generate_drawio` when the user wants a `.drawio` output file.

## Available MCP Tools

### `build_project_index`

Build static indexes under the analyzed project's `.project-kg/` directory.

Use for:

- First-time project reading.
- Refreshing stale indexes after code changes.
- Preparing for overview, dependency, trace, or draw.io generation.

Input:

```json
{
  "projectPath": "absolute/or/relative/path/to/python/project",
  "maxDepth": 8
}
```

Output includes index path and counts for files, symbols, dependencies, and calls.

### `get_project_overview`

Read `.project-kg/` and summarize the project.

Use for:

- Explaining the project at a high level.
- Finding entrypoints and core files.
- Deciding what diagram or trace to generate next.

Input:

```json
{
  "projectPath": "path/to/python/project"
}
```

### `get_module_dependencies`

Return dependency graph data from `.project-kg/`.

Use for:

- Understanding module imports.
- Explaining which modules depend on each other.
- Preparing architecture explanations before generating `core_modules` diagrams.

Input:

```json
{
  "projectPath": "path/to/python/project",
  "includeExternal": false
}
```

### `trace_feature_flow`

Trace a bounded call chain from a user query.

Use for:

- "Show me the login flow."
- "Trace `UserService.login`."
- "What happens after this handler is called?"
- "Draw the core method chain for this feature."

The query can be an exact qualified name, short method/function name, class name, file-path fragment, or simple tokenized phrase.

Input:

```json
{
  "projectPath": "path/to/python/project",
  "query": "UserService.login",
  "maxDepth": 4
}
```

Read `matches` in the response. If the top match is weak or multiple matches look plausible, explain the candidates and ask the user which one to trace, unless the user's intent is obvious.

### `generate_drawio`

Write a `.drawio` file.

Use for:

- Overall architecture diagrams.
- Feature or method-chain diagrams.
- Final visual output requested by the user.

Architecture diagram:

```json
{
  "projectPath": "path/to/python/project",
  "mode": "core_modules",
  "outputPath": "path/to/output/project-core.drawio"
}
```

Feature trace diagram:

```json
{
  "projectPath": "path/to/python/project",
  "mode": "feature_trace",
  "query": "UserService.login",
  "maxDepth": 4,
  "outputPath": "path/to/output/login-flow.drawio"
}
```

If `outputPath` is omitted, the tool writes a default `.drawio` file in the analyzed project directory.

## Workflows

### Overall Project Architecture

Use this when the user asks for a project architecture diagram, project overview, module map, or "read this project and draw the structure".

Steps:

1. Call `build_project_index`.
2. Call `get_project_overview`.
3. Optionally call `get_module_dependencies` with `includeExternal: false`.
4. Call `generate_drawio` with `mode: "core_modules"`.
5. Tell the user where the `.drawio` file was written and summarize what the diagram shows.

Notes:

- `core_modules` classifies modules into roles such as entrypoint, interface, service, domain, repository, model, package, and module.
- Use the overview and dependency graph to explain key entrypoints and important dependencies.

### Core Method Chain / Feature Flow

Use this when the user asks how a feature works, asks for a method call flow, or provides a function/class/file to trace.

Steps:

1. Call `build_project_index` if needed.
2. Call `trace_feature_flow` with the user's query.
3. Inspect `rootSymbolId`, `matches`, `steps`, and `edges`.
4. If no root was found, report that no matching symbol was found and show useful candidate guidance if available.
5. If the match is acceptable, call `generate_drawio` with `mode: "feature_trace"` and the same query.
6. Tell the user where the `.drawio` file was written and summarize the root method and main downstream calls.

## Agent Behavior

- Do not assume `.project-kg/` exists or is current. Build or refresh it first unless the user says otherwise.
- Do not scan ignored directories such as `.git/`, `.venv/`, `__pycache__/`, `node_modules/`, `dist/`, and `.project-kg/`.
- Prefer absolute `projectPath` values when available.
- Keep generated indexes inside the analyzed project; they are expected under `.project-kg/`.
- Write requested draw.io files only to user-appropriate output paths.
- When a query is ambiguous, use `trace_feature_flow.matches` to present candidates or choose the strongest obvious match.
- Explain limitations honestly: import and call resolution are static approximations, not full Python runtime execution.

## Common Prompts

User asks:

```text
Read this Python project and draw the overall architecture.
```

Do:

1. `build_project_index`
2. `get_project_overview`
3. `generate_drawio` with `mode: "core_modules"`

User asks:

```text
Draw the login flow.
```

Do:

1. `build_project_index`
2. `trace_feature_flow` with `query: "login"` or the user's exact phrase
3. Check `matches`
4. `generate_drawio` with `mode: "feature_trace"`

User asks:

```text
Trace UserService.login and output draw.io.
```

Do:

1. `build_project_index`
2. `trace_feature_flow` with `query: "UserService.login"`
3. `generate_drawio` with `mode: "feature_trace"` and `query: "UserService.login"`
