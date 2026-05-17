import { cp, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildProjectIndex } from "../src/core/build-project-index.js";
import { generateDrawioTool } from "../src/tools/generate-drawio.js";

const fixturePath = path.resolve("tests/fixtures/simple-python-project");
const tempProjects: string[] = [];

describe("generateDrawioTool", () => {
  afterEach(async () => {
    await Promise.all(tempProjects.splice(0).map((projectPath) => rm(projectPath, { recursive: true, force: true })));
  });

  it("writes a core modules drawio file from an existing project index", async () => {
    const projectPath = await copyFixtureToTempProject();
    await buildProjectIndex({ projectPath });

    const outputPath = path.join(projectPath, "diagrams", "core.drawio");
    const result = await generateDrawioTool({
      projectPath,
      mode: "core_modules",
      format: "drawio",
      outputPath
    });

    const xml = await readFile(outputPath, "utf8");

    expect(result).toEqual(
      expect.objectContaining({
        outputPath,
        nodeCount: expect.any(Number),
        edgeCount: expect.any(Number)
      })
    );
    expect(result.nodeCount).toBeGreaterThan(0);
    expect(result.edgeCount).toBeGreaterThan(0);
    await expect(stat(outputPath)).resolves.toBeTruthy();
    expect(xml).toContain("<mxfile");
    expect(xml).toContain("Core Python Module Dependencies");
    expect(xml).toContain("Entrypoints");
    expect(xml).toContain("Service Layer");
    expect(xml).toContain("Data Access");
    expect(xml).toContain("main.py");
    expect(xml).toContain("app/services/user_service.py");
  });

  it("writes a feature trace drawio file for a requested method chain", async () => {
    const projectPath = await copyFixtureToTempProject();
    await buildProjectIndex({ projectPath });

    const outputPath = path.join(projectPath, "diagrams", "login-flow.drawio");
    const result = await generateDrawioTool({
      projectPath,
      mode: "feature_trace",
      format: "drawio",
      query: "UserService.login",
      outputPath
    });

    const xml = await readFile(outputPath, "utf8");

    expect(result.nodeCount).toBeGreaterThan(1);
    expect(result.edgeCount).toBeGreaterThan(0);
    await expect(stat(outputPath)).resolves.toBeTruthy();
    expect(xml).toContain("Feature Trace: UserService.login");
    expect(xml).toContain("UserService.login");
    expect(xml).toContain("UserRepository.find_by_email");
    expect(xml).toContain("find_by_email");
  });

  it("writes an annotated feature flow drawio file", async () => {
    const projectPath = await copyFixtureToTempProject();
    await buildProjectIndex({ projectPath });

    const outputPath = path.join(projectPath, "diagrams", "login-feature-flow.drawio");
    const result = await generateDrawioTool({
      projectPath,
      mode: "feature_flow",
      format: "drawio",
      query: "UserService.login",
      maxDepth: 3,
      maxNodes: 8,
      includeDataFlow: true,
      outputPath
    });

    const xml = await readFile(outputPath, "utf8");

    expect(result.nodeCount).toBeGreaterThan(1);
    expect(result.edgeCount).toBeGreaterThan(1);
    await expect(stat(outputPath)).resolves.toBeTruthy();
    expect(xml).toContain("Feature Flow: UserService.login");
    expect(xml).toContain("Legend");
    expect(xml).toContain("Validate credentials and return login data.");
    expect(xml).toContain("Load a user record by email.");
    expect(xml).toContain("1. find_by_email");
    expect(xml).toContain("in: email");
    expect(xml).toContain("out: user");
    expect(xml).toContain("strokeColor=#2563eb");
    expect(xml).toContain("strokeColor=#16a34a");
  });

  it("writes a core modules mermaid file", async () => {
    const projectPath = await copyFixtureToTempProject();
    await buildProjectIndex({ projectPath });

    const outputPath = path.join(projectPath, "diagrams", "core.md");
    const result = await generateDrawioTool({
      projectPath,
      mode: "core_modules",
      format: "mermaid",
      outputPath
    });

    const content = await readFile(outputPath, "utf8");

    expect(result.format).toBe("mermaid");
    expect(result.content).toBeTruthy();
    expect(content).toContain("```mermaid");
    expect(content).toContain("flowchart LR");
    expect(content).toContain("Entrypoints");
    expect(content).toContain("Service Layer");
    expect(content).toContain("Data Access");
    expect(content).toContain("main");
    expect(content).toContain("user_service");
  });

  it("writes a feature flow mermaid file with inline content", async () => {
    const projectPath = await copyFixtureToTempProject();
    await buildProjectIndex({ projectPath });

    const outputPath = path.join(projectPath, "diagrams", "login-flow.md");
    const result = await generateDrawioTool({
      projectPath,
      mode: "feature_flow",
      format: "mermaid",
      query: "UserService.login",
      maxDepth: 3,
      maxNodes: 8,
      includeDataFlow: true,
      outputPath
    });

    const content = await readFile(outputPath, "utf8");

    expect(result.format).toBe("mermaid");
    expect(result.content).toContain("```mermaid");
    expect(result.content).toContain("UserService.login");
    expect(result.content).toContain("find_by_email");
    expect(content).toContain("flowchart LR");
    expect(content).toContain("classDef branch");
    expect(result.nodeCount).toBeGreaterThan(1);
  });

  it("defaults to mermaid format when no format is specified", async () => {
    const projectPath = await copyFixtureToTempProject();
    await buildProjectIndex({ projectPath });

    const result = await generateDrawioTool({
      projectPath,
      mode: "feature_flow",
      query: "UserService.login",
      maxDepth: 3,
      maxNodes: 8
    });

    expect(result.format).toBe("mermaid");
    expect(result.content).toContain("```mermaid");
    expect(result.content).toContain("flowchart LR");
  });
});

async function copyFixtureToTempProject(): Promise<string> {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), "project-kg-"));
  tempProjects.push(projectPath);
  await cp(fixturePath, projectPath, { recursive: true });
  return projectPath;
}
