import path from "node:path";
import { describe, expect, it } from "vitest";
import { scanPythonProject } from "../src/core/scanner.js";

const fixturePath = path.resolve("tests/fixtures/simple-python-project");

describe("scanPythonProject", () => {
  it("classifies Python files and entrypoints", async () => {
    const index = await scanPythonProject({ projectPath: fixturePath });

    expect(index.entrypoints).toContain("main.py");
    expect(index.packages).toContain("app");
    expect(index.files.some((file) => file.path === "app/services/user_service.py")).toBe(true);
  });
});
