import { describe, expect, it } from "vitest";
import { resolveRuntimeSecret } from "./runtimeSecrets";

describe("resolveRuntimeSecret", () => {
  it("prefers an explicit runtime-config value", () => {
    expect(resolveRuntimeSecret(
      " configured-secret ",
      "EXAMPLE_SECRET",
      { EXAMPLE_SECRET: "environment-secret" },
    )).toBe("configured-secret");
  });

  it("falls back to the function environment", () => {
    expect(resolveRuntimeSecret(
      "",
      "EXAMPLE_SECRET",
      { EXAMPLE_SECRET: " environment-secret " },
    )).toBe("environment-secret");
  });

  it("fails closed when the secret is unavailable", () => {
    expect(resolveRuntimeSecret("", "EXAMPLE_SECRET", {})).toBe("");
  });
});
