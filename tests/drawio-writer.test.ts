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
});
