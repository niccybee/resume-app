import { BlockLibraryError } from "../../domain/blocks/blockLibrary";
import { normalizeEmploymentGroup } from "../../domain/employment/occasion";

async function defaultGetActor(client) {
  if (typeof client.auth?.getSession === "function") {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data?.session?.user || null;
  }
  return client.auth?.user?.() || null;
}

function throwRepositoryError(error) {
  if (!error) return;
  const message = error.message || "The block repository request failed.";
  const code = /referenced.*archive/i.test(message)
    ? "block-referenced"
    : /changed since|conflict/i.test(message)
    ? "conflict"
    : /auth/i.test(message)
      ? "authentication-required"
      : "repository-error";
  throw new BlockLibraryError(
    code,
    code === "conflict"
      ? "This CV Block changed since you opened it. Review the latest Block Version and try again."
      : message,
    code === "block-referenced" ? { nextActions: ["archive"] } : null,
  );
}

function mapContext(row) {
  return {
    id: row.id,
    type: row.context_type,
    key: row.context_key,
    label: row.label,
    metadata: row.metadata || {},
  };
}

function mapVersion(row) {
  return {
    id: row.id,
    blockId: row.block_id,
    number: row.version_number,
    content: row.content,
    schemaVersion: row.schema_version || "1",
    source: {
      type: row.source_type,
      ...(row.source_metadata || {}),
    },
    basedOnVersionId: row.based_on_version_id,
    createdAt: row.created_at,
  };
}

function mapBlock(row) {
  const versions = (row.versions || [])
    .map(mapVersion)
    .sort((left, right) => left.number - right.number);

  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    status: row.status,
    contexts: (row.cv_block_contexts || []).map(mapContext),
    currentVersion:
      versions.find((version) => version.id === row.current_version_id) || null,
    versions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseBlockRepository({
  client,
  getActor = () => defaultGetActor(client),
}) {
  if (!client) {
    throw new BlockLibraryError(
      "missing-client",
      "The Supabase block repository requires a client.",
    );
  }

  async function requireActor({ optional = false } = {}) {
    const actor = await getActor();
    if (!actor && !optional) {
      throw new BlockLibraryError(
        "authentication-required",
        "Sign in before changing CV blocks.",
      );
    }
    return actor;
  }

  return {
    async browse(query = {}) {
      const actor = await requireActor({ optional: true });
      if (!actor) return [];

      let searchBlockIds;
      const search = query.search?.trim().toLowerCase();
      if (search) {
        const { data, error } = await client.rpc("search_mcp_cv_block_ids", {
          p_search: search,
          p_kind: query.kind || null,
          p_include_archived: Boolean(query.includeArchived),
          p_limit: query.limit || 50,
        });
        throwRepositoryError(error);
        searchBlockIds = (data || []).map((row) => row.block_id);
        if (searchBlockIds.length === 0) return [];
      }

      let request = client
        .from("cv_blocks")
        .select(
          `
            id,
            kind,
            title,
            status,
            current_version_id,
            created_at,
            updated_at,
            cv_block_contexts (
              id,
              context_type,
              context_key,
              label,
              metadata
            ),
            versions:cv_block_versions!cv_block_versions_block_id_fkey (
              id,
              block_id,
              version_number,
              schema_version,
              content,
              source_type,
              source_metadata,
              based_on_version_id,
              created_at
            )
          `,
        )
        .eq("owner_id", actor.id);

      if (!query.includeArchived) request = request.eq("status", "active");

      if (query.blockId) request = request.eq("id", query.blockId);
      if (searchBlockIds) request = request.in("id", searchBlockIds);
      if (query.kind) request = request.eq("kind", query.kind);
      request = request.order("updated_at", {
        ascending: false,
      });
      if (query.limit) request = request.limit(query.limit);
      if (query.versionHistoryLimit) {
        request = request
          .order("version_number", { ascending: false, foreignTable: "versions" })
          .limit(query.versionHistoryLimit, { foreignTable: "versions" });
      }
      const { data, error } = await request;
      throwRepositoryError(error);

      return (data || [])
        .map(mapBlock)
        .filter((block) => {
          if (query.section && !block.contexts.some((context) =>
            context.type === "sidebar" && context.key === query.section)) {
            return false;
          }
          if (!query.companyId && !query.roleId && !query.occasionId) return true;
          return block.contexts.some((context) => {
            const employment = normalizeEmploymentGroup(context.metadata);
            return (
              context.type === "employment" &&
              (!query.companyId ||
                employment.employerId === query.companyId) &&
              (!query.roleId || employment.roleId === query.roleId) &&
              (!query.occasionId ||
                employment.occasionId === query.occasionId)
            );
          });
        })
        .filter((block) => {
          if (!search) return true;
          return JSON.stringify({
            title: block.title,
            content: block.currentVersion?.content,
            contexts: block.contexts,
          })
            .toLowerCase()
            .includes(search);
        });
    },

    async saveVersion(input) {
      await requireActor();
      const { data, error } = await client.rpc("save_cv_block_version", {
        p_block_id: input.blockId || null,
        p_kind: input.kind || null,
        p_title: input.title || null,
        p_content: input.content,
        p_schema_version: input.schemaVersion || "1",
        p_based_on_version_id: input.basedOnVersionId || null,
        p_source_type: input.source?.type || "human",
        p_source_metadata: input.source || {},
        p_contexts: input.contexts || null,
      });
      throwRepositoryError(error);
      return data;
    },

    async saveVersions(inputs) {
      await requireActor();
      const { data, error } = await client.rpc("save_cv_block_versions", {
        p_versions: inputs.map((input) => ({
          block_id: input.blockId || null,
          kind: input.kind || null,
          title: input.title || null,
          content: input.content,
          schema_version: input.schemaVersion || "1",
          based_on_version_id: input.basedOnVersionId || null,
          source_type: input.source?.type || "human",
          source_metadata: input.source || {},
          contexts: input.contexts || null,
        })),
      });
      throwRepositoryError(error);
      return data || [];
    },

    async resolve(versionIds) {
      const actor = await requireActor({ optional: true });
      if (!actor || versionIds.length === 0) return [];

      const { data, error } = await client
        .from("cv_block_versions")
        .select(
          "id, block_id, version_number, schema_version, content, source_type, source_metadata, based_on_version_id, created_at",
        )
        .eq("owner_id", actor.id)
        .in("id", versionIds);
      throwRepositoryError(error);

      const byId = new Map((data || []).map((row) => [row.id, mapVersion(row)]));
      return versionIds.map((versionId) => {
        const version = byId.get(versionId);
        if (!version) {
          throw new BlockLibraryError(
            "version-not-found",
            `Block version not found: ${versionId}`,
          );
        }
        return version;
      });
    },

    async recordSuggestion(input) {
      const actor = await requireActor();
      const { data, error } = await client
        .from("cv_generation_runs")
        .insert({
          block_id: input.blockId,
          owner_id: actor.id,
          based_on_version_id: input.basedOnVersionId,
          instruction: input.instruction,
          provider: input.generator,
          status: "draft",
          output_content: input.content,
        })
        .select()
        .single();
      throwRepositoryError(error);
      return data;
    },

    async duplicateBlock(blockId, { title } = {}) {
      await requireActor();
      const { data, error } = await client.rpc("duplicate_cv_block", {
        p_block_id: blockId,
        p_title: title || null,
      });
      throwRepositoryError(error);
      return data;
    },

    async setBlockStatus(blockId, status) {
      await requireActor();
      const { data, error } = await client.rpc("set_cv_block_status", {
        p_block_id: blockId,
        p_status: status,
      });
      throwRepositoryError(error);
      return data;
    },

    async deleteBlock(blockId) {
      await requireActor();
      const { data, error } = await client.rpc("delete_cv_block", {
        p_block_id: blockId,
      });
      throwRepositoryError(error);
      return data;
    },
  };
}
