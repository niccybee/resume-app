import { describe, expect, it, vi } from "vitest";
import {
  DEVELOPER_ACCESS_STORAGE_KEY,
  disableDeveloperAccess,
  enableDeveloperAccess,
  isDeveloperAccessAvailable,
  isDeveloperAccessEnabled,
} from "./developerAccess";

function storage() {
  const values = new Map();
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    removeItem: vi.fn((key) => values.delete(key)),
  };
}

describe("developer workspace access", () => {
  it("can be enabled for the current browser tab in development", () => {
    const sessionStorage = storage();

    expect(isDeveloperAccessAvailable({ dev: true })).toBe(true);
    expect(enableDeveloperAccess({ dev: true, storage: sessionStorage })).toBe(true);
    expect(isDeveloperAccessEnabled({ dev: true, storage: sessionStorage })).toBe(true);
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      DEVELOPER_ACCESS_STORAGE_KEY,
      "enabled",
    );

    disableDeveloperAccess({ storage: sessionStorage });
    expect(isDeveloperAccessEnabled({ dev: true, storage: sessionStorage })).toBe(false);
  });

  it("fails closed outside development even if storage was previously enabled", () => {
    const sessionStorage = storage();
    sessionStorage.setItem(DEVELOPER_ACCESS_STORAGE_KEY, "enabled");

    expect(isDeveloperAccessAvailable({ dev: false })).toBe(false);
    expect(isDeveloperAccessEnabled({ dev: false, storage: sessionStorage })).toBe(false);
    expect(enableDeveloperAccess({ dev: false, storage: sessionStorage })).toBe(false);
  });
});
