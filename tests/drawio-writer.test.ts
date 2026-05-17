import { describe, expect, it } from "vitest";
import { renderDrawioXml } from "../src/core/drawio-writer.js";

describe("renderDrawioXml", () => {
  it("renders drawio xml with nodes and edges", () => {
    const xml = renderDrawioXml({
      title: "Test Diagram",
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" }
      ],
      edges: [{ from: "a", to: "b", label: "calls" }]
    });

    expect(xml).toContain("<mxfile");
    expect(xml).toContain("source=\"a\"");
    expect(xml).toContain("target=\"b\"");
  });

  it("renders architecture group headers for grouped module diagrams", () => {
    const xml = renderDrawioXml({
      title: "Architecture",
      nodes: [
        { id: "main.py", label: "main", kind: "entrypoint", group: "entrypoint" },
        { id: "app/services/user_service.py", label: "user_service", kind: "service", group: "service" },
        { id: "app/repositories/user_repository.py", label: "user_repository", kind: "repository", group: "repository" }
      ],
      edges: [
        { from: "main.py", to: "app/services/user_service.py" },
        { from: "app/services/user_service.py", to: "app/repositories/user_repository.py" }
      ]
    });

    expect(xml).toContain("Entrypoints");
    expect(xml).toContain("Service Layer");
    expect(xml).toContain("Data Access");
    expect(xml).toContain("fillColor=#ede9fe");
    expect(xml).toContain("fillColor=#ffedd5");
  });

  it("renders feature flow legend and edge styles", () => {
    const xml = renderDrawioXml({
      title: "Feature Flow",
      mode: "feature_flow",
      nodes: [
        { id: "a", label: "A", detail: "start", kind: "flow-main", isMainPath: true },
        { id: "b", label: "B", detail: "next", kind: "flow-main", isMainPath: true }
      ],
      edges: [
        { from: "a", to: "b", label: "1. call", kind: "call", sequence: 1 },
        { from: "a", to: "b", label: "in: email", kind: "data_in", sequence: 1 },
        { from: "b", to: "a", label: "out: user", kind: "data_out", sequence: 1 },
        { from: "b", to: "a", label: "return: user", kind: "return", sequence: 1 }
      ],
      legend: [
        { label: "Call order", kind: "call" },
        { label: "Data input", kind: "data_in" },
        { label: "Data output", kind: "data_out" },
        { label: "Return value", kind: "return" }
      ]
    });

    expect(xml).toContain("Legend");
    expect(xml).toContain("Call order");
    expect(xml).toContain("Data input");
    expect(xml).toContain("strokeColor=#2563eb");
    expect(xml).toContain("strokeColor=#16a34a");
    expect(xml).toContain("strokeColor=#059669");
    expect(xml).toContain("fillColor=#ecfdf5");
  });
});
