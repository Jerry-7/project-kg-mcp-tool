import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildProjectIndex } from "../src/core/build-project-index.js";
import { traceFeature, traceFeatureFlow } from "../src/core/graph-builder.js";
import { readProjectKgStore } from "../src/core/index-store.js";

const fixturePath = path.resolve("tests/fixtures/simple-python-project");
const tempProjects: string[] = [];

describe("buildProjectIndex", () => {
  afterEach(async () => {
    await Promise.all(tempProjects.splice(0).map((projectPath) => rm(projectPath, { recursive: true, force: true })));
  });

  it("builds dependency and call indexes for a Python project", async () => {
    const projectPath = await copyFixtureToTempProject();

    const result = await buildProjectIndex({ projectPath });
    const store = await readProjectKgStore(projectPath);

    expect(result.fileCount).toBeGreaterThan(0);
    expect(store.dependencyGraph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "main.py",
          to: "app/services/user_service.py",
          confidence: "high"
        }),
        expect.objectContaining({
          from: "app/services/user_service.py",
          to: "app/repositories/user_repository.py",
          confidence: "high"
        })
      ])
    );

    expect(store.callGraph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "main.py::main",
          to: "app/services/user_service.py::UserService.login",
          confidence: "high"
        }),
        expect.objectContaining({
          from: "app/services/user_service.py::UserService.login",
          to: "app/repositories/user_repository.py::UserRepository.find_by_email",
          confidence: "high"
        })
      ])
    );
    expect(
      store.callGraph.edges.find((edge) => edge.to === "app/repositories/user_repository.py::UserRepository.find_by_email")
    ).toEqual(
      expect.objectContaining({
        sequence: 1,
        arguments: ["email"],
        assignmentTarget: "user",
        receiver: "self.repository"
      })
    );
    expect(store.symbolIndex.symbols.find((symbol) => symbol.id === "app/services/user_service.py::UserService.login")).toEqual(
      expect.objectContaining({
        docstring: "Validate credentials and return login data."
      })
    );

    const trace = traceFeature(store, "UserService.login");
    expect(trace.matches?.[0]).toEqual(
      expect.objectContaining({
        symbolId: "app/services/user_service.py::UserService.login",
        label: "UserService.login"
      })
    );
    expect(trace.edges).toContainEqual(
      expect.objectContaining({
        from: "app/services/user_service.py::UserService.login",
        to: "app/repositories/user_repository.py::UserRepository.find_by_email",
        label: "find_by_email"
      })
    );

    const shortNameTrace = traceFeature(store, "login");
    expect(shortNameTrace.rootSymbolId).toBe("app/services/user_service.py::UserService.login");
    expect(shortNameTrace.matches?.[0]?.reason).toBe("symbol name");

    const naturalQueryTrace = traceFeature(store, "user login");
    expect(naturalQueryTrace.rootSymbolId).toBe("app/services/user_service.py::UserService.login");

    const flow = traceFeatureFlow(store, "UserService.login");
    expect(flow.rootSymbolId).toBe("app/services/user_service.py::UserService.login");
    expect(flow.options).toEqual(
      expect.objectContaining({
        maxDepth: 4,
        maxNodes: 12,
        includeBranches: false,
        includeReturns: true,
        includeDataFlow: true,
        detailLevel: "summary"
      })
    );
    expect(flow.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbolId: "app/services/user_service.py::UserService.login",
          annotation: "Validate credentials and return login data.",
          isMainPath: true
        }),
        expect.objectContaining({
          symbolId: "app/repositories/user_repository.py::UserRepository.find_by_email",
          annotation: "Load a user record by email.",
          sequence: 1,
          isMainPath: true
        })
      ])
    );
    expect(flow.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "app/services/user_service.py::UserService.login",
          to: "app/repositories/user_repository.py::UserRepository.find_by_email",
          kind: "call",
          sequence: 1,
          label: "1. find_by_email"
        }),
        expect.objectContaining({
          kind: "data_in",
          label: "in: email"
        }),
        expect.objectContaining({
          kind: "data_out",
          label: "out: user"
        })
      ])
    );

    const noDataFlow = traceFeatureFlow(store, "UserService.login", { includeDataFlow: false });
    expect(noDataFlow.edges.some((edge) => edge.kind === "data_in" || edge.kind === "data_out")).toBe(false);

    const noMatchTrace = traceFeature(store, "billing checkout");
    expect(noMatchTrace.rootSymbolId).toBeUndefined();
    expect(noMatchTrace.matches).toEqual([]);
    expect(noMatchTrace.steps).toEqual([]);
  });
});

async function copyFixtureToTempProject(): Promise<string> {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), "project-kg-"));
  tempProjects.push(projectPath);
  await cp(fixturePath, projectPath, { recursive: true });
  return projectPath;
}
