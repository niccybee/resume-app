import { describe, expect, it, vi } from "vitest";
import { createSupabaseCvRepository } from "./createSupabaseCvRepository";

describe("Supabase CV repository public boundary", () => {
  it("returns a published CV through the curated public contract", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          id: "cv-public",
          name: "Product CV",
          slug: "product-cv",
          status: "published",
          themeId: "editorial",
          profile: {
            basics: {
              name: "Nic Benson",
              email: "nic@example.com",
            },
          },
          summary: "Product leader.",
          publishedAt: "2026-07-21T00:00:00.000Z",
          selections: [
            {
              blockId: "block-1",
              versionId: "version-1",
              section: "experience",
              order: 0,
              content: { text: "Shipped the platform." },
              block: { title: "Platform delivery", kind: "experience" },
            },
          ],
        },
        error: null,
      }),
      from: vi.fn(() => {
        throw new Error("Public CV reads must not query protected tables.");
      }),
    };
    const repository = createSupabaseCvRepository({ client });

    const document = await repository.getPublished("product-cv");

    expect(document).toEqual({
      id: "cv-public",
      name: "Product CV",
      slug: "product-cv",
      status: "published",
      themeId: "editorial",
      profile: {
        basics: {
          name: "Nic Benson",
          email: "nic@example.com",
        },
      },
      summary: "Product leader.",
      summaryProvenance: null,
      publishedAt: "2026-07-21T00:00:00.000Z",
      selections: [
        {
          blockId: "block-1",
          versionId: "version-1",
          section: "experience",
          order: 0,
          content: { text: "Shipped the platform." },
          block: { title: "Platform delivery", kind: "experience" },
        },
      ],
    });
  });
});
