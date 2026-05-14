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
});

async function copyFixtureToTempProject(): Promise<string> {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), "project-kg-"));
  tempProjects.push(projectPath);
  await cp(fixturePath, projectPath, { recursive: true });
  return projectPath;
}
