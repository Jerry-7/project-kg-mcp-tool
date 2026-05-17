import path from "node:path";
import { describe, expect, it } from "vitest";
import { parsePythonFile } from "../src/core/python-parser.js";

describe("parsePythonFile", () => {
  it("extracts imports, symbols, and calls", async () => {
    const filePath = path.resolve("tests/fixtures/simple-python-project/app/services/user_service.py");
    const parsed = await parsePythonFile(filePath, "app/services/user_service.py");

    expect(parsed.imports[0]?.module).toBe("app.repositories.user_repository");
    expect(parsed.symbols.map((symbol) => symbol.qualifiedName)).toContain("UserService.login");

    expect(parsed.symbols.find((symbol) => symbol.qualifiedName === "UserService")).toEqual(
      expect.objectContaining({
        docstring: "Application service for user login.",
        leadingComment: "Coordinates user authentication."
      })
    );
    expect(parsed.symbols.find((symbol) => symbol.qualifiedName === "UserService.login")).toEqual(
      expect.objectContaining({
        docstring: "Validate credentials and return login data."
      })
    );

    expect(parsed.calls.find((call) => call.calleeName === "find_by_email")).toEqual(
      expect.objectContaining({
        sequence: 1,
        arguments: ["email"],
        assignmentTarget: "user",
        receiver: "self.repository"
      })
    );
  });
});
