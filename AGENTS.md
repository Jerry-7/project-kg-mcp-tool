# Repository Guidelines

## Project Structure & Module Organization

This repository implements a TypeScript/Node.js MCP server for indexing Python projects and generating draw.io diagrams. Source code lives in `src/`: MCP wiring is under `src/mcp/`, tool handlers under `src/tools/`, reusable analysis logic under `src/core/`, and shared TypeScript types under `src/types/`. Tests live in `tests/`, with sample Python projects in `tests/fixtures/`.

Generated indexes are written to the analyzed project, not this repository:

```text
.project-kg/
  project-index.json
  dependency-graph.json
  symbol-index.json
  call-graph.json
```

## Build, Test, and Development Commands

Use Node.js 20 or newer.

```sh
npm install
npm run build
npm test
npm run dev
```

`npm run build` compiles TypeScript to `dist/`. `npm test` runs Vitest. `npm run dev` starts the MCP server from `src/index.ts` using `tsx`.

## Coding Style & Naming Conventions

Use strict TypeScript, ES modules, and explicit exported types for data crossing module boundaries. File names should be `kebab-case`, classes and interfaces `PascalCase`, and variables/functions `camelCase`. Keep parsing, graph construction, storage, and MCP transport concerns separated.

Prefer small pure functions in `src/core/`. Tool handlers in `src/tools/` should validate inputs with Zod and delegate business logic to core modules.

## Testing Guidelines

Use Vitest for unit tests. Name tests after the module under test, for example `scanner.test.ts` or `drawio-writer.test.ts`. Add or update fixtures in `tests/fixtures/` when changing AST extraction, dependency resolution, or trace behavior.

Run the full suite before submitting changes:

```sh
npm test
```

## Commit & Pull Request Guidelines

The repository has no established commit history yet. Use concise, imperative commit messages such as `Add Python symbol analyzer` or `Fix drawio edge escaping`.

Pull requests should include a short description, test evidence, and examples of generated output when diagram behavior changes. Keep parser, graph, and MCP API changes clearly described because agents depend on stable index schemas.

## Agent-Specific Instructions

Do not assume missing indexes exist; call `build_project_index` before reading `.project-kg/`. Avoid scanning ignored directories such as `.git/`, `.venv/`, `__pycache__/`, `node_modules/`, `dist/`, and `.project-kg/`. Preserve user-created files and avoid editing analyzed target projects except when explicitly writing requested index or draw.io output files.
