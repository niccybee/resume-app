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
          revisionId: "revision-1",
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
      publishedRevisionId: "revision-1",
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
      theme_id: "legacy-theme",
      profile: { basics: { name: "Legacy mutable content" } },
      summary: "Legacy mutable summary",
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
      expect.objectContaining({
        id: "owned-cv",
        name: "Owned CV",
        themeId: null,
        profile: {},
        summary: "",
        selections: [],
      }),
    ]);
    expect(query.select).toHaveBeenCalledWith(
      "id, name, slug, status, published_at, published_revision_id",
    );
    expect(query.eq).toHaveBeenCalledWith("owner_id", "user-1");
  });

  it("uses a verified request actor for server-side user-token reads", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const client = {
      auth: { getSession: vi.fn() },
      from: vi.fn().mockReturnValue(query),
    };
    const getActor = vi.fn().mockResolvedValue({ id: "mcp-owner" });
    const repository = createSupabaseCvRepository({ client, getActor });

    await expect(repository.list()).resolves.toEqual([]);
    expect(getActor).toHaveBeenCalledOnce();
    expect(client.auth.getSession).not.toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith("owner_id", "mcp-owner");
  });
});

describe("Supabase CV repository Revision history boundary", () => {
  it("lists immutable Revisions for one owned CV lineage", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{
          id: "revision-1",
          cv_id: "cv-1",
          revision_number: 1,
          base_revision_id: null,
          theme_id: "modern",
          profile: { basics: { name: "Nic" } },
          summary: "Product leader.",
          summary_provenance: null,
          created_at: "2026-07-21T00:00:00.000Z",
        }],
        error: null,
      }),
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

    await expect(repository.listRevisions("cv-1")).resolves.toEqual([{
      id: "revision-1",
      cvId: "cv-1",
      number: 1,
      baseRevisionId: null,
      themeId: "modern",
      profile: { basics: { name: "Nic" } },
      summary: "Product leader.",
      summaryProvenance: null,
      createdAt: "2026-07-21T00:00:00.000Z",
    }]);
    expect(client.from).toHaveBeenCalledWith("cv_revisions");
    expect(query.eq).toHaveBeenCalledWith("cv_id", "cv-1");
    expect(query.eq).toHaveBeenCalledWith("owner_id", "user-1");
    expect(query.order).toHaveBeenCalledWith("revision_number", { ascending: false });
  });

  it("retrieves one exact immutable Revision snapshot for export", async () => {
    const snapshot = {
      id: "revision-1", cvId: "cv-1", number: 1, profile: { basics: { name: "Nic" } }, summary: "Leader",
      selections: [{ blockId: "block-1", versionId: "version-1", section: "experience", order: 0, content: { text: "Shipped" }, block: { kind: "experience" } }],
    };
    const client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" } } }, error: null }) },
      rpc: vi.fn().mockResolvedValue({ data: snapshot, error: null }),
    };
    const repository = createSupabaseCvRepository({ client });

    await expect(repository.getRevision("cv-1", "revision-1")).resolves.toEqual(snapshot);
    expect(client.rpc).toHaveBeenCalledWith("get_cv_revision_snapshot", {
      p_cv_id: "cv-1", p_revision_id: "revision-1",
    });
  });
});

describe("Supabase CV repository Editing Session boundary", () => {
  it.each([
    "Invalid lifecycle transition.",
    "Copy source Editing Session is not open.",
    "CV Block is referenced by a non-archived CV Composition or Working Composition.",
  ])("maps lifecycle proposal failure %s to a stable transition code", async (message) => {
    const client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" } } } }) },
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "55000", message } }),
    };
    const repository = createSupabaseCvRepository({ client });

    await expect(repository.createChangeProposal({
      schemaVersion: "1", operationType: "restore_cv",
      target: { type: "cv", id: "cv-1" }, baseOptimisticVersion: null,
      operations: [{ type: "restore_cv", target: { type: "cv", id: "cv-1" } }],
    })).rejects.toMatchObject({ code: "invalid-lifecycle-transition" });
  });
  it("routes lifecycle Change Proposals through the generic proposal contract", async () => {
    const row = {
      id: "proposal-copy", schema_version: "1", operation_type: "copy_to_new_version",
      target_type: "editing_session", target_id: "session-1", target_cv_id: "cv-1",
      base_optimistic_version: 2,
      normalized_operations: [{ type: "copy_to_new_version", source: { type: "editing_session", id: "session-1" }, baseOptimisticVersion: 2 }],
      structured_diff: { lifecycle: { operation: "copy_to_new_version" } }, warnings: [], status: "pending",
    };
    const client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" } } }, error: null }) },
      rpc: vi.fn().mockResolvedValue({ data: row, error: null }),
    };
    const repository = createSupabaseCvRepository({ client });
    const input = {
      schemaVersion: "1", operationType: "copy_to_new_version",
      target: { type: "editing_session", id: "session-1" }, baseOptimisticVersion: 2,
      operations: row.normalized_operations,
    };
    await expect(repository.createChangeProposal(input)).resolves.toMatchObject({
      operationType: "copy_to_new_version", status: "pending",
    });
    expect(client.rpc).toHaveBeenCalledWith("create_cv_lifecycle_proposal", {
      p_schema_version: "1", p_operation: row.normalized_operations[0],
    });
  });

  it.each([
    {
      operationType: "archive_cv_block",
      result: { blockId: "block-1", currentVersionId: "version-2" },
      code: "stale-block-version",
    },
    {
      operationType: "finish_editing_session",
      result: { reason: "invalid-lifecycle-transition", target: { id: "session-1" } },
      code: "invalid-lifecycle-transition",
    },
  ])("maps invalidated $operationType lifecycle proposals to $code", async ({ operationType, result, code }) => {
    const pending = {
      id: "proposal-lifecycle", schema_version: "1", operation_type: operationType,
      target_type: operationType.endsWith("cv_block") ? "cv_block" : "editing_session",
      target_id: operationType.endsWith("cv_block") ? "block-1" : "session-1",
      target_cv_id: operationType.endsWith("cv_block") ? null : "cv-1",
      base_optimistic_version: 2, normalized_operations: [], structured_diff: {},
      warnings: [], status: "pending", result: null,
    };
    const client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" } } } }) },
      rpc: vi.fn(async (name) => ({
        data: name === "get_cv_change_proposal" ? pending : { ...pending, status: "invalidated", result },
        error: null,
      })),
    };
    const repository = createSupabaseCvRepository({ client });

    await expect(repository.applyChangeProposal("proposal-lifecycle")).rejects.toMatchObject({
      code,
      context: result,
    });
  });
  it("creates, reads, applies, and discards Change Proposals through owner-scoped atomic RPCs", async () => {
    const proposal = {
      id: "proposal-1",
      schema_version: "1",
      operation_type: "replace_working_state",
      target_type: "editing_session",
      target_id: "session-1",
      target_cv_id: "cv-1",
      base_optimistic_version: 1,
      normalized_operations: [{ type: "replace_working_state", value: { name: "Product CV", selections: [] } }],
      structured_diff: { fields: [], composition: { added: [], removed: [], replaced: [], moved: [] } },
      warnings: [],
      status: "pending",
      created_at: "2026-07-21T00:00:00.000Z",
      expires_at: "2026-07-22T00:00:00.000Z",
      result: null,
    };
    const client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" } } }, error: null }) },
      rpc: vi.fn(async (name, params) => {
        if (name === "get_cv_editing_session") {
          return { data: { id: "session-1", cv_id: "cv-1", optimistic_version: 1, status: "open", working_name: "Product CV", working_profile: {}, selections: [] }, error: null };
        }
        if (name === "create_cv_change_proposal") return { data: proposal, error: null };
        if (name === "get_cv_change_proposal") return { data: proposal, error: null };
        if (name === "apply_cv_change_proposal") {
          return { data: { ...proposal, status: "applied", result: { editingSessionId: "session-1", optimisticVersion: 2 } }, error: null };
        }
        if (name === "discard_cv_change_proposal") return { data: { ...proposal, status: "discarded" }, error: null };
        throw new Error(`Unexpected RPC ${name}: ${JSON.stringify(params)}`);
      }),
    };
    const repository = createSupabaseCvRepository({ client });
    const input = {
      schemaVersion: "1",
      operationType: "replace_working_state",
      target: { type: "editing_session", id: "session-1", cvId: "cv-1" },
      baseOptimisticVersion: 1,
      operations: proposal.normalized_operations,
    };

    await expect(repository.createChangeProposal(input)).resolves.toMatchObject({
      id: "proposal-1", schemaVersion: "1", status: "pending", nextActions: ["apply", "discard"],
    });
    await expect(repository.getChangeProposal("proposal-1")).resolves.toMatchObject({ id: "proposal-1" });
    await expect(repository.applyChangeProposal("proposal-1")).resolves.toMatchObject({ status: "applied" });
    await expect(repository.discardChangeProposal("proposal-1")).resolves.toMatchObject({ status: "discarded" });
    expect(client.rpc).toHaveBeenCalledWith("create_cv_change_proposal", {
      p_schema_version: "1",
      p_operation_type: "replace_working_state",
      p_target_session_id: "session-1",
      p_base_optimistic_version: 1,
      p_normalized_operations: proposal.normalized_operations,
    });
    expect(client.rpc).toHaveBeenCalledWith("get_cv_change_proposal", { p_proposal_id: "proposal-1" });
    expect(client.rpc).toHaveBeenCalledWith("apply_cv_change_proposal", { p_proposal_id: "proposal-1" });
    expect(client.rpc).toHaveBeenCalledWith("discard_cv_change_proposal", { p_proposal_id: "proposal-1" });
  });

  it("routes generic content proposals through the atomic content RPC", async () => {
    const proposal = {
      id: "proposal-content",
      schema_version: "1",
      operation_type: "edit_content",
      target_type: "editing_session",
      target_id: "session-1",
      target_cv_id: "cv-1",
      base_optimistic_version: 3,
      normalized_operations: [{
        type: "append_block_version",
        kind: "experience",
        blockId: "block-1",
        basedOnVersionId: "version-1",
        schemaVersion: "1",
        content: { text: "Improved result." },
        source: { type: "mcp" },
      }],
      structured_diff: { blocks: [] },
      warnings: [],
      status: "pending",
    };
    const client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" } } } }) },
      rpc: vi.fn(async (name) => {
        if (name === "create_cv_content_change_proposal") return { data: proposal, error: null };
        if (name === "get_cv_change_proposal") return { data: proposal, error: null };
        if (name === "apply_cv_content_change_proposal") return {
          data: { ...proposal, status: "applied", result: {
            editingSessionId: "session-1",
            optimisticVersion: 4,
            affectedIdentities: { cvId: "cv-1", blockIds: ["block-1"], versionIds: ["version-2"] },
          } },
          error: null,
        };
        throw new Error(`Unexpected RPC: ${name}`);
      }),
    };
    const repository = createSupabaseCvRepository({ client });
    const input = {
      schemaVersion: "1",
      operationType: "edit_content",
      target: { type: "editing_session", id: "session-1", cvId: "cv-1" },
      baseOptimisticVersion: 3,
      operations: proposal.normalized_operations,
    };

    await expect(repository.createChangeProposal(input)).resolves.toMatchObject({
      id: "proposal-content", operationType: "edit_content",
    });
    await expect(repository.applyChangeProposal("proposal-content")).resolves.toMatchObject({
      status: "applied", result: { optimisticVersion: 4 },
    });
    expect(client.rpc).toHaveBeenCalledWith("create_cv_content_change_proposal", {
      p_schema_version: "1",
      p_target_session_id: "session-1",
      p_base_optimistic_version: 3,
      p_normalized_operations: proposal.normalized_operations,
    });
    expect(client.rpc).toHaveBeenCalledWith("apply_cv_content_change_proposal", {
      p_proposal_id: "proposal-content",
    });
  });

  it.each([
    {
      result: { code: "stale-block-version", blockId: "block-1", currentVersionId: "version-2" },
      code: "stale-block-version",
    },
    {
      result: { code: "invalid-lifecycle-transition", reason: "archived-cv", cvId: "cv-1", status: "archived" },
      code: "invalid-lifecycle-transition",
    },
  ])("maps invalidated content proposals to $code", async ({ result, code }) => {
    const pending = {
      id: "proposal-content", schema_version: "1", operation_type: "edit_content",
      target_type: "editing_session", target_id: "session-1", target_cv_id: "cv-1",
      base_optimistic_version: 3, normalized_operations: [], structured_diff: {},
      warnings: [], status: "pending", result: null,
    };
    const client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" } } } }) },
      rpc: vi.fn(async (name) => ({
        data: name === "get_cv_change_proposal"
          ? pending
          : { ...pending, status: "invalidated", result },
        error: null,
      })),
    };
    const repository = createSupabaseCvRepository({ client });

    await expect(repository.applyChangeProposal("proposal-content")).rejects.toMatchObject({
      code,
      context: result,
    });
  });

  it("maps stale proposal failures with refreshed target context", async () => {
    const client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" } } }, error: null }) },
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "40001", message: 'stale-proposal: {"target":{"id":"session-1","optimisticVersion":2}}' },
      }),
    };
    const repository = createSupabaseCvRepository({ client });

    await expect(repository.applyChangeProposal("proposal-1")).rejects.toMatchObject({
      code: "stale-proposal",
      context: { target: { id: "session-1", optimisticVersion: 2 } },
    });
  });

  it("normalizes the database stale snapshot into the shared Editing Session context", async () => {
    const client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" } } }, error: null }) },
      rpc: vi.fn().mockResolvedValue({
        data: {
          id: "proposal-1", schema_version: "1", operation_type: "replace_working_state",
          target_type: "editing_session", target_id: "session-1", target_cv_id: "cv-1",
          base_optimistic_version: 1, normalized_operations: [], structured_diff: {},
          warnings: [], status: "invalidated",
          result: { target: {
            id: "session-1", cv_id: "cv-1", base_revision_id: "revision-1",
            status: "open", optimistic_version: 2, working_name: "Product CV",
            working_profile: { basics: { name: "Nic" } }, working_summary: "Winning change",
            selections: [{ block_id: "block-1", version_id: "version-1", section: "experience", position: 0, content: { text: "Won" }, display: {} }],
          } },
        },
        error: null,
      }),
    };
    const repository = createSupabaseCvRepository({ client });

    await expect(repository.applyChangeProposal("proposal-1")).rejects.toMatchObject({
      code: "stale-proposal",
      context: { target: {
        id: "session-1", cvId: "cv-1", optimisticVersion: 2,
        name: "Product CV", summary: "Winning change",
        selections: [{ blockId: "block-1", versionId: "version-1", order: 0 }],
      } },
    });
  });

  it("lists multiple owner-scoped sessions for one CV without loading every composition", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{
          id: "session-2",
          cv_id: "cv-1",
          owner_id: "user-1",
          base_revision_id: "revision-1",
          status: "open",
          optimistic_version: 2,
          working_name: "Product CV",
          working_profile: {},
          updated_at: "2026-07-21T02:00:00.000Z",
        }, {
          id: "session-1",
          cv_id: "cv-1",
          owner_id: "user-1",
          base_revision_id: "revision-1",
          status: "open",
          optimistic_version: 1,
          working_name: "Product CV",
          working_profile: {},
          updated_at: "2026-07-21T01:00:00.000Z",
        }],
        error: null,
      }),
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

    await expect(repository.listEditingSessions("cv-1")).resolves.toEqual([
      expect.objectContaining({ id: "session-2", optimisticVersion: 2 }),
      expect.objectContaining({ id: "session-1", optimisticVersion: 1 }),
    ]);
    expect(query.eq).toHaveBeenCalledWith("cv_id", "cv-1");
    expect(query.eq).toHaveBeenCalledWith("owner_id", "user-1");
    expect(query.order).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(client.from).toHaveBeenCalledOnce();
  });

  it("starts, reloads, saves, and finishes one durable Working Composition", async () => {
    let sessionRow = {
      id: "session-1",
      cv_id: "cv-1",
      owner_id: "user-1",
      base_revision_id: "revision-1",
      status: "open",
      optimistic_version: 1,
      working_name: "Product CV",
      working_theme_id: "editorial",
      working_profile: { basics: { name: "Nic" } },
      working_summary: "Revision one",
      working_summary_provenance: null,
      finished_revision_id: null,
      created_at: "2026-07-21T00:00:00.000Z",
      updated_at: "2026-07-21T00:00:00.000Z",
      finished_at: null,
    };
    const selections = [{
      block_id: "block-1",
      version_id: "version-1",
      section: "experience",
      position: 0,
      display: { title: "Platform delivery" },
      content: { text: "Shipped the platform." },
      source_type: "human",
      source_metadata: {},
    }];
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        }),
      },
      rpc: vi.fn(async (name) => {
        if (name === "get_cv_editing_session") {
          return { data: { ...sessionRow, selections }, error: null };
        }
        if (name === "start_cv_editing_session") {
          return { data: "session-1", error: null };
        }
        if (name === "save_cv_editing_session") {
          sessionRow = {
            ...sessionRow,
            optimistic_version: 2,
            working_summary: "Persisted session work",
          };
          return { data: "session-1", error: null };
        }
        sessionRow = {
          ...sessionRow,
          status: "finished",
          optimistic_version: 3,
          finished_revision_id: "revision-2",
          finished_at: "2026-07-21T01:00:00.000Z",
        };
        return { data: "revision-2", error: null };
      }),
      from: vi.fn(() => {
        throw new Error("Editing Session reloads must use one database snapshot RPC.");
      }),
    };
    const repository = createSupabaseCvRepository({ client });

    const started = await repository.startEditingSession("cv-1", "revision-1");
    const saved = await repository.saveEditingSession({
      ...started,
      summary: "Persisted session work",
    });
    const finished = await repository.finishEditingSession(
      saved.id,
      saved.optimisticVersion,
    );

    expect(client.rpc).toHaveBeenCalledWith("start_cv_editing_session", {
      p_cv_id: "cv-1",
      p_base_revision_id: "revision-1",
    });
    expect(client.rpc).toHaveBeenCalledWith("save_cv_editing_session", {
      p_session_id: "session-1",
      p_expected_version: 1,
      p_name: "Product CV",
      p_theme_id: "editorial",
      p_profile: { basics: { name: "Nic" } },
      p_summary: "Persisted session work",
      p_summary_provenance: null,
      p_selections: [{
        block_id: "block-1",
        version_id: "version-1",
        section: "experience",
        position: 0,
        display: { title: "Platform delivery" },
      }],
    });
    expect(client.rpc).toHaveBeenCalledWith("finish_cv_editing_session", {
      p_session_id: "session-1",
      p_expected_version: 2,
    });
    expect(finished).toMatchObject({
      id: "session-1",
      cvId: "cv-1",
      status: "finished",
      optimisticVersion: 3,
      finishedRevisionId: "revision-2",
      selections: [expect.objectContaining({ versionId: "version-1" })],
    });
    expect(client.rpc).toHaveBeenCalledWith("get_cv_editing_session", {
      p_session_id: "session-1",
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("maps optimistic conflicts to the Editing Session domain", async () => {
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "40001", message: "session-conflict" },
      }),
      from: vi.fn(),
    };
    const repository = createSupabaseCvRepository({ client });

    await expect(repository.saveEditingSession({
      id: "session-1",
      cvId: "cv-1",
      optimisticVersion: 1,
      name: "Product CV",
      profile: {},
      selections: [],
    })).rejects.toMatchObject({ code: "session-conflict" });
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("Supabase CV repository initial Editing Session boundary", () => {
  it("creates a CV lineage and initial Working Composition through one transactional RPC", async () => {
    const created = {
      id: "session-1", cv_id: "cv-1", base_revision_id: null, status: "open", optimistic_version: 1,
      working_name: "Product CV", working_theme_id: "editorial", working_profile: { basics: { name: "Nic" } },
      working_summary: "Product leader.", working_summary_provenance: null,
      selections: [{ block_id: "block-1", version_id: "version-1", section: "experience", position: 0, content: { text: "Shipped" }, display: { title: "Platform delivery" } }],
    };
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        }),
      },
      rpc: vi.fn(async (name) => name === "create_cv_with_editing_session"
        ? { data: "session-1", error: null }
        : { data: created, error: null }),
    };
    const repository = createSupabaseCvRepository({ client });

    const saved = await repository.createCvEditingSession({
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

    expect(client.rpc).toHaveBeenCalledWith("create_cv_with_editing_session", {
      p_state: {
        name: "Product CV", themeId: "editorial", profile: { basics: { name: "Nic" } },
        summary: "Product leader.", summaryProvenance: null,
        selections: [expect.objectContaining({ blockId: "block-1", versionId: "version-1" })],
      },
    });
    expect(client.rpc).toHaveBeenCalledWith("get_cv_editing_session", { p_session_id: "session-1" });
    expect(saved).toMatchObject({ id: "session-1", cvId: "cv-1", baseRevisionId: null, status: "open" });
    expect(saved.selections[0]).toMatchObject({
      versionId: "version-1", content: { text: "Shipped" },
    });
  });

  it("does not expose the removed mutable save path", () => {
    const client = { rpc: vi.fn() };
    const repository = createSupabaseCvRepository({ client });

    expect(repository.save).toBeUndefined();
    expect(client.rpc).not.toHaveBeenCalled();
  });
});

describe("Supabase CV repository legacy publication boundary", () => {
  it("rejects direct publication writes without calling revoked RPCs", async () => {
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({ data: "cv-1", error: null }),
    };
    const repository = createSupabaseCvRepository({ client });

    await expect(repository.publish("cv-1", "product-cv"))
      .rejects.toMatchObject({ code: "explicit-apply-required" });
    await expect(repository.unpublish("cv-1"))
      .rejects.toMatchObject({ code: "explicit-apply-required" });
    expect(client.rpc).not.toHaveBeenCalled();
  });
});

describe("Supabase CV publication proposal boundary", () => {
  it("routes publish and withdrawal proposals through dedicated reviewed RPCs", async () => {
    const pending = {
      id: "proposal-1", schema_version: "1", operation_type: "publish_revision",
      target_type: "cv_revision", target_id: "revision-2", target_cv_id: "cv-1",
      normalized_operations: [], structured_diff: {}, warnings: [], status: "pending",
    };
    const client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" } } }, error: null }) },
      rpc: vi.fn(async (name) => {
        if (name === "create_cv_publication_proposal") return { data: pending, error: null };
        if (name === "get_cv_change_proposal") return { data: pending, error: null };
        if (name === "apply_cv_publication_proposal") return { data: { ...pending, status: "applied", result: { cvId: "cv-1", revisionId: "revision-2" } }, error: null };
        throw new Error(`Unexpected RPC ${name}`);
      }),
    };
    const repository = createSupabaseCvRepository({ client });
    const input = {
      schemaVersion: "1", operationType: "publish_revision",
      target: { type: "cv_revision", id: "revision-2", cvId: "cv-1" },
      baseOptimisticVersion: null,
      operations: [{ type: "publish_revision", target: { type: "cv_revision", id: "revision-2", cvId: "cv-1" }, slug: "product-cv" }],
    };

    await repository.createChangeProposal(input);
    await repository.applyChangeProposal("proposal-1");

    expect(client.rpc).toHaveBeenCalledWith("create_cv_publication_proposal", {
      p_schema_version: "1", p_operation: input.operations[0],
    });
    expect(client.rpc).toHaveBeenCalledWith("apply_cv_publication_proposal", { p_proposal_id: "proposal-1" });
  });
});
