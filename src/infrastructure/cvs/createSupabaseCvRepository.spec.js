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
});

describe("Supabase CV repository Editing Session boundary", () => {
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

describe("Supabase CV repository legacy publication boundary", () => {
  it("publishes through the transactional CV Revision pinning RPC", async () => {
    const documentQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "cv-1",
          owner_id: "user-1",
          name: "Product CV",
          slug: "product-cv",
          status: "published",
          profile: {},
          published_at: "2026-07-21T00:00:00.000Z",
        },
        error: null,
      }),
    };
    const compositionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then(resolve) {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
    };
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-1" } } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({ data: "cv-1", error: null }),
      from: vi.fn((table) => ({
        cv_documents: documentQuery,
        cv_compositions: compositionQuery,
      })[table]),
    };
    const repository = createSupabaseCvRepository({ client });

    await expect(repository.publish("cv-1", "product-cv")).resolves.toMatchObject({
      id: "cv-1",
      status: "published",
      slug: "product-cv",
    });
    expect(client.rpc).toHaveBeenCalledWith("publish_cv_document", {
      p_cv_id: "cv-1",
      p_slug: "product-cv",
    });
    expect(documentQuery.update).toBeUndefined();
  });
});
