import { describe, expect, it, vi } from "vitest";
import { createSupabaseBlockRepository } from "./createSupabaseBlockRepository";

describe("Supabase block repository batch boundary", () => {
  it("saves a reviewed block set through one atomic RPC", async () => {
    const versions = [
      { id: "version-1", blockId: "block-1", number: 1, content: { text: "First" } },
      { id: "version-2", blockId: "block-2", number: 1, content: { text: "Second" } },
    ];
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: versions, error: null }),
    };
    const repository = createSupabaseBlockRepository({
      client,
      getActor: vi.fn().mockResolvedValue({ id: "owner-1" }),
    });
    const inputs = [{
      kind: "experience",
      title: "Growth Lead at E2: First",
      content: { text: "First" },
      contexts: [{ type: "employment", key: "e2-growth-2024", metadata: { occasionId: "e2-growth-2024" } }],
      source: { type: "ai", provider: "openrouter" },
    }, {
      kind: "experience",
      title: "Growth Lead at E2: Second",
      content: { text: "Second" },
      contexts: [{ type: "employment", key: "e2-growth-2024", metadata: { occasionId: "e2-growth-2024" } }],
      source: { type: "ai", provider: "openrouter" },
    }];

    await expect(repository.saveVersions(inputs)).resolves.toEqual(versions);
    expect(client.rpc).toHaveBeenCalledOnce();
    expect(client.rpc).toHaveBeenCalledWith("save_cv_block_versions", {
      p_versions: inputs.map((input) => ({
        block_id: null,
        kind: input.kind,
        title: input.title,
        content: input.content,
        based_on_version_id: null,
        source_type: "ai",
        source_metadata: input.source,
        contexts: input.contexts,
      })),
    });
  });
});

describe("Supabase block repository browse boundary", () => {
  it("returns nothing for a signed-out actor without querying CV Blocks", async () => {
    const client = { from: vi.fn() };
    const repository = createSupabaseBlockRepository({
      client,
      getActor: vi.fn().mockResolvedValue(null),
    });

    await expect(repository.browse()).resolves.toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("loads only the authenticated actor's active CV Blocks", async () => {
    const rows = [{
      id: "owned-active",
      owner_id: "owner-1",
      kind: "experience",
      title: "Owned active CV Block",
      status: "active",
      current_version_id: null,
      cv_block_contexts: [],
      versions: [],
    }, {
      id: "owned-archived",
      owner_id: "owner-1",
      kind: "experience",
      title: "Owned archived CV Block",
      status: "archived",
      current_version_id: null,
      cv_block_contexts: [],
      versions: [],
    }, {
      id: "other-active",
      owner_id: "owner-2",
      kind: "experience",
      title: "Another actor's CV Block",
      status: "active",
      current_version_id: null,
      cv_block_contexts: [],
      versions: [],
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
      from: vi.fn().mockReturnValue(query),
    };
    const repository = createSupabaseBlockRepository({
      client,
      getActor: vi.fn().mockResolvedValue({ id: "owner-1" }),
    });

    await expect(repository.browse()).resolves.toEqual([
      expect.objectContaining({ id: "owned-active", status: "active" }),
    ]);
    expect(query.eq).toHaveBeenCalledWith("owner_id", "owner-1");
    expect(query.eq).toHaveBeenCalledWith("status", "active");
  });

  it("filters legacy Employment Occasion metadata through normalized stable IDs", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{
          id: "legacy-employment",
          kind: "experience",
          title: "Legacy Employment Occasion",
          status: "active",
          current_version_id: null,
          cv_block_contexts: [{
            id: "context-1",
            context_type: "employment",
            context_key: "legacy-context",
            label: "Google · Product Manager",
            metadata: {
              company: "Google",
              role: "Product Manager",
              startDate: "2021-01",
              endDate: "2022-12",
            },
          }, {
            id: "context-2",
            context_type: "sidebar",
            context_key: "skills",
            label: "Skills",
            metadata: {},
          }],
          versions: [],
        }, {
          id: "sidebar-only",
          kind: "skill",
          title: "Sidebar-only CV Block",
          status: "active",
          current_version_id: null,
          cv_block_contexts: [{
            id: "context-3",
            context_type: "sidebar",
            context_key: "skills",
            label: "Skills",
            metadata: {},
          }],
          versions: [],
        }],
        error: null,
      }),
    };
    const repository = createSupabaseBlockRepository({
      client: { from: vi.fn().mockReturnValue(query) },
      getActor: vi.fn().mockResolvedValue({ id: "owner-1" }),
    });

    await expect(repository.browse({
      companyId: "google",
      roleId: "product-manager",
      occasionId: "google-product-manager-2021-01",
      section: "skills",
    })).resolves.toEqual([
      expect.objectContaining({ id: "legacy-employment" }),
    ]);
  });

  it("canonicalizes stale-write conflicts at the repository boundary", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "This block has changed since the selected base version" },
      }),
    };
    const repository = createSupabaseBlockRepository({
      client,
      getActor: vi.fn().mockResolvedValue({ id: "owner-1" }),
    });

    await expect(repository.saveVersion({
      blockId: "block-1",
      basedOnVersionId: "version-1",
      content: { text: "Stale change" },
    })).rejects.toMatchObject({
      code: "conflict",
      message: "This CV Block changed since you opened it. Review the latest Block Version and try again.",
    });
  });
});
