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
