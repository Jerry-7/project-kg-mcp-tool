#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { startServer } from "./mcp/server.js";
import { buildProjectIndexTool } from "./tools/build-project-index.js";
import { generateDrawioTool } from "./tools/generate-drawio.js";
import { getModuleDependenciesTool } from "./tools/get-module-dependencies.js";
import { getProjectOverviewTool } from "./tools/get-project-overview.js";
import { traceFeatureFlowTool } from "./tools/trace-feature-flow.js";

type CliCommand = "serve" | "build" | "overview" | "deps" | "trace" | "drawio" | "help";

export interface CliInvocation {
  command: CliCommand;
  input: Record<string, unknown>;
}

export class CliArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliArgumentError";
  }
}

const usage = `project-kg <command> [options]

Commands:
  serve                              Start the MCP stdio server
  build <projectPath>                Build .project-kg indexes
  overview <projectPath>             Print project overview from .project-kg
  deps <projectPath>                 Print module dependency graph
  trace <projectPath> <query>        Trace a feature/function call flow
  drawio <projectPath> --mode <mode> Generate a draw.io diagram

Options:
  --max-depth <number>               Limit scan or trace depth
  --include-external                 Include external dependency nodes
  --mode <core_modules|feature_trace|feature_flow>
  --query <text>                     Feature query for feature_trace or feature_flow mode
  --output <path>                    Output diagram path
  --format <mermaid|drawio>          Output format (default: mermaid)
  --max-nodes <number>               Limit feature_flow nodes
  --include-branches                 Include branch/helper calls in feature_flow
  --no-returns                       Omit return edges in feature_flow
  --no-data-flow                     Omit data input/output edges in feature_flow
  --detail-level <summary|full>      Control feature_flow node detail
  --help                             Show this help

Examples:
  project-kg build ./my-python-app
  project-kg overview ./my-python-app
  project-kg trace ./my-python-app "UserService.login" --max-depth 3
  project-kg drawio ./my-python-app --mode core_modules --output ./core.md
  project-kg drawio ./my-python-app --mode feature_flow --query "UserService.login" --max-depth 3 --max-nodes 8 --output ./login-flow.md
`;

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const invocation = parseCliArguments(argv);

  if (invocation.command === "help") {
    console.log(usage);
    return;
  }

  if (invocation.command === "serve") {
    await startServer();
    return;
  }

  const result = await runToolInvocation(invocation);
  console.log(JSON.stringify(result, null, 2));
}

export function parseCliArguments(argv: string[]): CliInvocation {
  const [commandToken, ...rest] = argv;
  const command = normalizeCommand(commandToken);

  if (command === "help" || rest.includes("--help") || rest.includes("-h")) {
    return { command: "help", input: {} };
  }

  const parsed = parseOptions(rest);

  switch (command) {
    case "serve":
      return { command, input: {} };
    case "build":
      return {
        command,
        input: withProjectPath(parsed, command)
      };
    case "overview":
      return {
        command,
        input: pickInput(withProjectPath(parsed, command), ["projectPath"])
      };
    case "deps":
      return {
        command,
        input: pickInput(withProjectPath(parsed, command), ["projectPath", "includeExternal"])
      };
    case "trace": {
      const input = withProjectPath(parsed, command);
      const query = parsed.positionals[1];
      if (!query) {
        throw new CliArgumentError("trace requires a query argument");
      }
      return {
        command,
        input: pickInput({ ...input, query }, ["projectPath", "query", "maxDepth"])
      };
    }
    case "drawio":
      return {
        command,
        input: pickInput(withProjectPath(parsed, command), [
          "projectPath",
          "mode",
          "format",
          "query",
          "outputPath",
          "maxDepth",
          "maxNodes",
          "includeBranches",
          "includeReturns",
          "includeDataFlow",
          "detailLevel"
        ])
      };
  }
}

async function runToolInvocation(invocation: CliInvocation): Promise<unknown> {
  switch (invocation.command) {
    case "build":
      return buildProjectIndexTool(invocation.input);
    case "overview":
      return getProjectOverviewTool(invocation.input);
    case "deps":
      return getModuleDependenciesTool(invocation.input);
    case "trace":
      return traceFeatureFlowTool(invocation.input);
    case "drawio":
      return generateDrawioTool(invocation.input);
    case "serve":
    case "help":
      return undefined;
  }
}

function normalizeCommand(command: string | undefined): CliCommand {
  if (!command) {
    return "help";
  }

  if (command === "--help" || command === "-h") {
    return "help";
  }

  if (["serve", "build", "overview", "deps", "trace", "drawio"].includes(command)) {
    return command as CliCommand;
  }

  throw new CliArgumentError(`Unknown command: ${command}`);
}

interface ParsedOptions {
  positionals: string[];
  values: Record<string, unknown>;
}

function parseOptions(args: string[]): ParsedOptions {
  const positionals: string[] = [];
  const values: Record<string, unknown> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;

    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const [rawName, inlineValue] = arg.slice(2).split("=", 2);
    const name = normalizeOptionName(rawName);

    if (name === "includeExternal" || name === "includeBranches") {
      values[name] = true;
      continue;
    }

    if (name === "includeReturns" || name === "includeDataFlow") {
      values[name] = false;
      continue;
    }

    const value = inlineValue ?? args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new CliArgumentError(`Missing value for --${rawName}`);
    }
    index += inlineValue === undefined ? 1 : 0;

    if (name === "maxDepth" || name === "maxNodes") {
      values[name] = parsePositiveInteger(value, rawName);
    } else {
      values[name] = value;
    }
  }

  return { positionals, values };
}

function normalizeOptionName(name: string): string {
  switch (name) {
    case "max-depth":
      return "maxDepth";
    case "include-external":
      return "includeExternal";
    case "include-branches":
      return "includeBranches";
    case "no-returns":
      return "includeReturns";
    case "no-data-flow":
      return "includeDataFlow";
    case "max-nodes":
      return "maxNodes";
    case "detail-level":
      return "detailLevel";
    case "output":
      return "outputPath";
    case "mode":
    case "query":
    case "format":
      return name;
    default:
      throw new CliArgumentError(`Unknown option: --${name}`);
  }
}

function parsePositiveInteger(value: string, optionName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CliArgumentError(`--${optionName} must be a positive integer`);
  }
  return parsed;
}

function withProjectPath(parsed: ParsedOptions, command: string): Record<string, unknown> {
  const projectPath = parsed.positionals[0];
  if (!projectPath) {
    throw new CliArgumentError(`${command} requires a projectPath argument`);
  }
  return {
    projectPath,
    ...parsed.values
  };
}

function pickInput(input: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));
}

if (isDirectInvocation()) {
  runCli().catch((error) => {
    const message = error instanceof z.ZodError ? `Invalid arguments: ${error.message}` : error instanceof Error ? error.message : String(error);
    console.error(message);
    if (error instanceof CliArgumentError || error instanceof z.ZodError) {
      console.error("");
      console.error(usage);
    }
    process.exitCode = 1;
  });
}

function isDirectInvocation(): boolean {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}
