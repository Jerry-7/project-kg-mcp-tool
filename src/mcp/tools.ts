import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { buildProjectIndexTool } from "../tools/build-project-index.js";
import { generateDrawioTool } from "../tools/generate-drawio.js";
import { getModuleDependenciesTool } from "../tools/get-module-dependencies.js";
import { getProjectOverviewTool } from "../tools/get-project-overview.js";
import { traceFeatureFlowTool } from "../tools/trace-feature-flow.js";

const toolDefinitions = [
  {
    name: "build_project_index",
    description: "Scan and index a Python project into .project-kg JSON files.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" },
        maxDepth: { type: "number" },
        force: { type: "boolean" }
      },
      required: ["projectPath"]
    }
  },
  {
    name: "get_project_overview",
    description: "Read .project-kg and summarize Python project entrypoints, packages, core files, and graph counts.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" }
      },
      required: ["projectPath"]
    }
  },
  {
    name: "get_module_dependencies",
    description: "Return Python module import dependency graph data from .project-kg.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" },
        includeExternal: { type: "boolean" }
      },
      required: ["projectPath"]
    }
  },
  {
    name: "trace_feature_flow",
    description: "Trace a bounded function or method call chain using the static symbol and call index.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" },
        query: { type: "string" },
        maxDepth: { type: "number" }
      },
      required: ["projectPath", "query"]
    }
  },
  {
    name: "generate_drawio",
    description: "Generate a draw.io file for core_modules or feature_trace mode.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" },
        mode: { type: "string", enum: ["core_modules", "feature_trace"] },
        outputPath: { type: "string" },
        query: { type: "string" },
        maxDepth: { type: "number" }
      },
      required: ["projectPath", "mode"]
    }
  }
];

const handlers = new Map<string, (input: unknown) => Promise<unknown>>([
  ["build_project_index", buildProjectIndexTool],
  ["get_project_overview", getProjectOverviewTool],
  ["get_module_dependencies", getModuleDependenciesTool],
  ["trace_feature_flow", traceFeatureFlowTool],
  ["generate_drawio", generateDrawioTool]
]);

export function registerProjectKgTools(server: Server): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const handler = handlers.get(request.params.name);
    if (!handler) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    try {
      const result = await handler(request.params.arguments ?? {});
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid tool arguments: ${error.message}`);
      }
      throw error;
    }
  });
}
