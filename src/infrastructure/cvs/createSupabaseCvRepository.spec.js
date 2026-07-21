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

describe("Supabase CV repository list boundary", () => {
  it("returns nothing for a signed-out actor without querying CV documents", async () => {
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
      },
      from: vi.fn(),
    };
    const repository = createSupabaseCvRepository({ client });

    await expect(repository.list()).resolves.toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("lists only CVs owned by the authenticated actor", async () => {
    const rows = [{
      id: "owned-cv",
      owner_id: "user-1",
      name: "Owned CV",
      status: "draft",
      profile: {},
    }, {
      id: "other-cv",
      owner_id: "user-2",
      name: "Another actor's CV",
      status: "draft",
      profile: {},
    }];
    const predicates = [];
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((column, value) => {
        predicates.push([column, value]);
        return query;
      }),
      order: vi.fn().mockImplementation(async () => ({
        data: rows.filter((row) => predicates.every(([column, value]) => row[column] === value)),
        error: null,
      })),
    };
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue(query),
    };
    const repository = createSupabaseCvRepository({ client });

    await expect(repository.list()).resolves.toEqual([
      expect.objectContaining({ id: "owned-cv", name: "Owned CV" }),
    ]);
    expect(query.eq).toHaveBeenCalledWith("owner_id", "user-1");
  });
});

describe("Supabase CV repository authenticated save boundary", () => {
  it("saves the document and exact composition through one transactional RPC", async () => {
    const documentQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "cv-1",
          owner_id: "user-1",
          name: "Product CV",
          status: "draft",
          theme_id: "editorial",
          profile: { basics: { name: "Nic" } },
          summary: "Product leader.",
          summary_provenance: null,
        },
        error: null,
      }),
    };
    const compositionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then(resolve) {
        return Promise.resolve({
          data: [{
            block_id: "block-1",
            version_id: "version-1",
            section: "experience",
            position: 0,
            display: {
              title: "Platform delivery",
              grouping: {
                employerId: "e2",
                employer: "E2",
                occasionId: "e2-product-2024",
                role: "Product Lead",
                startDate: "2024-01",
                endDate: "present",
              },
            },
          }],
          error: null,
        }).then(resolve);
      },
    };
    const versionQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{
          id: "version-1",
          content: { text: "Shipped the platform." },
          source_type: "manual",
          source_metadata: {},
        }],
        error: null,
      }),
    };
    const from = vi.fn((table) => ({
      cv_documents: documentQuery,
      cv_compositions: compositionQuery,
      cv_block_versions: versionQuery,
    })[table]);
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({ data: "cv-1", error: null }),
      from,
    };
    const repository = createSupabaseCvRepository({ client });

    const saved = await repository.save({
      id: "cv-1",
      name: "Product CV",
      themeId: "editorial",
      profile: { basics: { name: "Nic" } },
      summary: "Product leader.",
      selections: [{
        blockId: "block-1",
        versionId: "version-1",
        section: "experience",
        order: 0,
        block: { title: "Platform delivery" },
        group: {
          employerId: "e2",
          employer: "E2",
          occasionId: "e2-product-2024",
          role: "Product Lead",
          startDate: "2024-01",
          endDate: "present",
        },
      }],
    });

    expect(client.rpc).toHaveBeenCalledOnce();
    expect(client.rpc).toHaveBeenCalledWith("save_cv_document", {
      p_cv_id: "cv-1",
      p_name: "Product CV",
      p_theme_id: "editorial",
      p_profile: { basics: { name: "Nic" } },
      p_summary: "Product leader.",
      p_summary_provenance: null,
      p_selections: [{
        block_id: "block-1",
        version_id: "version-1",
        section: "experience",
        position: 0,
        display: {
          title: "Platform delivery",
          grouping: {
            employerId: "e2",
            employer: "E2",
            occasionId: "e2-product-2024",
            role: "Product Lead",
            roleId: "product-lead",
            startDate: "2024-01",
            endDate: "present",
          },
        },
      }],
    });
    expect(documentQuery.update).toBeUndefined();
    expect(compositionQuery.delete).toBeUndefined();
    expect(from).not.toHaveBeenCalled();
    expect(saved.selections[0]).toMatchObject({
      versionId: "version-1",
      group: { occasionId: "e2-product-2024" },
    });
  });

  it("returns a useful domain error when the atomic save cannot update the CV", async () => {
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "P0002", message: "CV not found." },
      }),
      from: vi.fn(() => {
        throw new Error("A failed transaction must not trigger follow-up reads.");
      }),
    };
    const repository = createSupabaseCvRepository({ client });

    await expect(repository.save({ id: "missing", name: "Product CV" }))
      .rejects.toMatchObject({ code: "not-found", message: "CV not found." });
    expect(client.from).not.toHaveBeenCalled();
  });
});
