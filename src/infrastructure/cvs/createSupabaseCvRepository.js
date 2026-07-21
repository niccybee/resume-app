import { CvWorkspaceError } from "../../domain/cvs/createCvWorkspace";
import { normalizeDraft } from "../../domain/cvs/cvDraft";

function mapError(error) {
  if (!error) return;
  if (error.code === "23505") {
    throw new CvWorkspaceError("slug-conflict", "That public slug is already in use.");
  }
  if (error.code === "P0002") {
    throw new CvWorkspaceError("not-found", error.message || "CV not found.");
  }
  if (/jwt|auth|permission|row-level security/i.test(error.message || "")) {
    throw new CvWorkspaceError("authentication-required", "Sign in to manage CVs.");
  }
  throw new CvWorkspaceError("repository-error", error.message || "The CV request failed.");
}

function mapDocument(row, selections = []) {
  return normalizeDraft({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    themeId: row.theme_id,
    profile: row.profile || {},
    summary: row.summary,
    summaryProvenance: row.summary_provenance,
    publishedAt: row.published_at,
    selections,
  });
}

export function createSupabaseCvRepository({ client }) {
  async function actor({ optional = false } = {}) {
    const { data, error } = await client.auth.getSession();
    if (error && !optional) mapError(error);
    if (!data?.session?.user && !optional) {
      throw new CvWorkspaceError("authentication-required", "Sign in to manage CVs.");
    }
    return data?.session?.user || null;
  }

  async function selectionsFor(cvId) {
    const { data: selections, error } = await client
      .from("cv_compositions")
      .select("block_id, version_id, section, position, display")
      .eq("cv_id", cvId)
      .order("section")
      .order("position");
    mapError(error);
    const versionIds = (selections || []).map((item) => item.version_id);
    if (!versionIds.length) return [];
    const { data: versions, error: versionsError } = await client
      .from("cv_block_versions")
      .select("id, content, source_type, source_metadata")
      .in("id", versionIds);
    mapError(versionsError);
    const byId = new Map((versions || []).map((version) => [version.id, version]));
    return (selections || []).map((item) => ({
      blockId: item.block_id,
      versionId: item.version_id,
      section: item.section,
      order: item.position,
      content: byId.get(item.version_id)?.content || {},
      block: item.display || {},
      group: item.display?.grouping || undefined,
      source: byId.get(item.version_id)
        ? {
            type: byId.get(item.version_id).source_type,
            ...byId.get(item.version_id).source_metadata,
          }
        : null,
    }));
  }

  async function fetchOne(column, value, { published = false } = {}) {
    let request = client.from("cv_documents").select("*").eq(column, value);
    if (published) request = request.eq("status", "published");
    const { data, error } = await request.maybeSingle();
    mapError(error);
    if (!data) return null;
    return mapDocument(data, await selectionsFor(data.id));
  }

  return {
    async list() {
      const user = await actor({ optional: true });
      if (!user) return [];
      const { data, error } = await client
        .from("cv_documents")
        .select("*")
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false });
      mapError(error);
      return (data || []).map((row) => mapDocument(row));
    },

    async get(id) {
      await actor();
      return fetchOne("id", id);
    },

    async save(input) {
      await actor();
      const draft = normalizeDraft(input);
      const { data: id, error } = await client.rpc("save_cv_document", {
        p_cv_id: draft.id,
        p_name: draft.name,
        p_theme_id: draft.themeId,
        p_profile: draft.profile,
        p_summary: draft.summary || null,
        p_summary_provenance: draft.summaryProvenance,
        p_selections: draft.selections.map((selection) => ({
            block_id: selection.blockId,
            version_id: selection.versionId,
            section: selection.section,
            position: selection.order,
            display: {
              ...(selection.block || {}),
                ...(selection.group ? { grouping: selection.group } : {}),
            },
        })),
      });
      mapError(error);
      return normalizeDraft({ ...draft, id });
    },

    async publish(id, slug) {
      const user = await actor();
      const { data, error } = await client
        .from("cv_documents")
        .update({ status: "published", slug, published_at: new Date().toISOString() })
        .eq("id", id)
        .eq("owner_id", user.id)
        .select()
        .single();
      mapError(error);
      return mapDocument(data, await selectionsFor(id));
    },

    async unpublish(id) {
      const user = await actor();
      const { data, error } = await client
        .from("cv_documents")
        .update({ status: "draft", published_at: null })
        .eq("id", id)
        .eq("owner_id", user.id)
        .select()
        .single();
      mapError(error);
      return mapDocument(data, await selectionsFor(id));
    },

    async getPublished(slug) {
      const { data, error } = await client.rpc("get_published_cv", {
        p_slug: slug,
      });
      mapError(error);
      return data ? normalizeDraft(data) : null;
    },
  };
}
