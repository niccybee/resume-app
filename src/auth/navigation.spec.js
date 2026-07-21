import { describe, expect, it } from "vitest";
import {
  loginDestination,
  workspaceAccessResult,
} from "./navigation";

describe("workspace authentication navigation", () => {
  it("preserves an authenticated workspace destination", () => {
    expect(loginDestination("/app/blocks?view=archived")).toBe(
      "/app/blocks?view=archived",
    );
  });

  it.each([
    ["https://attacker.example", "/app/cvs"],
    ["//attacker.example", "/app/cvs"],
    ["/application", "/app/cvs"],
    ["/app/../login", "/app/cvs"],
    ["/app/%2e%2e/login", "/app/cvs"],
    ["/login", "/app/cvs"],
    [undefined, "/app/cvs"],
  ])("normalizes unsafe login destination %s", (value, expected) => {
    expect(loginDestination(value)).toBe(expected);
  });

  it("redirects signed-out workspace access with the full path preserved", () => {
    expect(workspaceAccessResult({
      user: null,
      fullPath: "/app/settings/ai?tab=model",
    })).toEqual({
      path: "/login",
      query: { redirect: "/app/settings/ai?tab=model" },
    });
  });

  it("allows a restored session into the workspace", () => {
    expect(workspaceAccessResult({
      user: { id: "owner" },
      fullPath: "/app/cvs",
    })).toBe(true);
  });
});
