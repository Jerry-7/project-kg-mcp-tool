#!/usr/bin/env node
import { startServer } from "./mcp/server.js";

startServer().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
