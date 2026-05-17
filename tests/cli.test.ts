import { describe, expect, it } from "vitest";
import { parseCliArguments } from "../src/cli.js";

describe("parseCliArguments", () => {
  it("parses build command options", () => {
    expect(parseCliArguments(["build", "sample-project", "--max-depth", "5"])).toEqual({
      command: "build",
      input: {
        projectPath: "sample-project",
        maxDepth: 5
      }
    });
  });

  it("parses dependency graph flags", () => {
    expect(parseCliArguments(["deps", "sample-project", "--include-external"])).toEqual({
      command: "deps",
      input: {
        projectPath: "sample-project",
        includeExternal: true
      }
    });
  });

  it("parses feature trace and drawio arguments", () => {
    expect(parseCliArguments(["trace", "sample-project", "user login", "--max-depth=3"])).toEqual({
      command: "trace",
      input: {
        projectPath: "sample-project",
        query: "user login",
        maxDepth: 3
      }
    });

    expect(parseCliArguments([
      "drawio",
      "sample-project",
      "--mode",
      "feature_flow",
      "--query",
      "UserService.login",
      "--output",
      "login.drawio",
      "--max-nodes",
      "8",
      "--include-branches",
      "--no-data-flow",
      "--detail-level",
      "full"
    ])).toEqual({
      command: "drawio",
      input: {
        projectPath: "sample-project",
        mode: "feature_flow",
        query: "UserService.login",
        outputPath: "login.drawio",
        maxNodes: 8,
        includeBranches: true,
        includeDataFlow: false,
        detailLevel: "full"
      }
    });
  });

  it("rejects incomplete commands", () => {
    expect(() => parseCliArguments(["trace", "sample-project"])).toThrow("trace requires a query argument");
    expect(() => parseCliArguments(["build", "--max-depth", "nope"])).toThrow("--max-depth must be a positive integer");
  });
});
