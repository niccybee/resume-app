import { describe, expect, it, vi } from "vitest";
import { createModeAwareService } from "./createModeAwareService";

describe("mode-aware service", () => {
  it("only delegates to the developer service when developer access is enabled", () => {
    let enabled = false;
    const primary = { source: vi.fn(() => "supabase") };
    const developer = { source: vi.fn(() => "fixtures") };
    const service = createModeAwareService({
      primary,
      developer,
      developerAccessEnabled: () => enabled,
    });

    expect(service.source()).toBe("supabase");
    enabled = true;
    expect(service.source()).toBe("fixtures");
    expect(primary.source).toHaveBeenCalledTimes(1);
    expect(developer.source).toHaveBeenCalledTimes(1);
  });
});
