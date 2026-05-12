import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerProjectKgTools } from "./tools.js";

export async function startServer(): Promise<void> {
  const server = new Server(
    {
      name: "project-kg",
      version: "0.1.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  registerProjectKgTools(server);
  await server.connect(new StdioServerTransport());
}
