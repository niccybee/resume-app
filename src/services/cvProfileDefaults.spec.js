// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  createDevelopmentCvProfileDefaults,
  createSupabaseCvProfileDefaults,
} from "./cvProfileDefaults";

describe("CV profile defaults", () => {
  it("loads account defaults with auth identity fallbacks", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              email: "owner@example.com",
              user_metadata: { full_name: "Owner Name" },
            },
          },
          error: null,
        }),
      },
    };

    await expect(
      createSupabaseCvProfileDefaults({ client }).load(),
    ).resolves.toEqual({
      name: "Owner Name",
      email: "owner@example.com",
    });
  });

  it("saves normalized name and email as non-sensitive account metadata", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const service = createSupabaseCvProfileDefaults({
      client: { auth: { updateUser } },
    });

    await expect(service.save({
      name: "  Nicholas Benson ",
      email: " nic@example.com ",
    })).resolves.toEqual({
      name: "Nicholas Benson",
      email: "nic@example.com",
      scope: "account",
    });
    expect(updateUser).toHaveBeenCalledWith({
      data: {
        resume_studio_profile: {
          name: "Nicholas Benson",
          email: "nic@example.com",
        },
      },
    });
  });

  it("keeps disposable defaults local in developer access mode", async () => {
    const storage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    };
    const service = createDevelopmentCvProfileDefaults({ storage });

    await expect(service.load()).resolves.toEqual({
      name: "Alex Morgan",
      email: "alex@example.com",
    });
    await service.save({ name: "Dev User", email: "dev@example.com" });
    expect(storage.setItem).toHaveBeenCalledWith(
      "resume-studio:profile-defaults",
      JSON.stringify({ name: "Dev User", email: "dev@example.com" }),
    );
  });
});
