import { createError } from "h3";
import { useEvent } from "nitropack/runtime";
import { createBlockLibrary } from "../../src/domain/blocks/blockLibrary";
import { createCvWorkspace } from "../../src/domain/cvs/createCvWorkspace";
import {
  MCP_READ_SCHEMA_VERSION,
  readEnvelope,
  supportedSchemas,
} from "../../src/domain/mcp/readContracts";
import { createSupabaseBlockRepository } from "../../src/infrastructure/blocks/createSupabaseBlockRepository";
import { createSupabaseCvRepository } from "../../src/infrastructure/cvs/createSupabaseCvRepository";

export function mcpReadResult(data) {
  const structuredContent = readEnvelope(data);
  return {
    structuredContent,
    content: [{ type: "text", text: JSON.stringify(structuredContent) }],
  };
}

function statusForCode(code) {
  if (code === "authentication-required") return 401;
  if (["not-found", "block-not-found", "version-not-found"].includes(code)) return 404;
  if (["invalid-kind", "invalid-content", "validation-failed"].includes(code)) return 400;
  return 500;
}

export function createMcpReadService({ client, user }) {
  const getActor = async () => user;
  const cvWorkspace = createCvWorkspace({
    repository: createSupabaseCvRepository({ client, getActor }),
  });
  const blockLibrary = createBlockLibrary({
    repository: createSupabaseBlockRepository({ client, getActor }),
  });

  async function listCvs() {
    const cvs = await cvWorkspace.list();
    return cvs.map((cv) => ({
      id: cv.id,
      name: cv.name,
      status: cv.status,
      slug: cv.slug,
      publishedAt: cv.publishedAt,
      publishedRevisionId: cv.publishedRevisionId,
    }));
  }

  async function getCv(cvId) {
    const cv = (await listCvs()).find((candidate) => candidate.id === cvId);
    if (!cv) throw createError({ statusCode: 404, statusMessage: "CV not found.", data: { code: "not-found" } });
    return cv;
  }

  return {
    listCvs,
    getCv,
    listCvRevisions: (cvId) => cvWorkspace.history(cvId),
    getCvRevision: (cvId, revisionId) => cvWorkspace.revision(cvId, revisionId),
    listEditingSessions: (cvId) => cvWorkspace.editingSessions(cvId),
    getEditingSession: (sessionId) => cvWorkspace.resumeEditingSession(sessionId),
    listCvBlocks: async (query) => (await blockLibrary.browse(query)).blocks,
    getCvBlock: (blockId) => blockLibrary.getBlock(blockId),
    getBlockVersion: (versionId) => blockLibrary.getVersion(versionId),
    getPublicationState: async (cvId) => {
      const cv = await getCv(cvId);
      return {
        cvId: cv.id,
        status: cv.status,
        slug: cv.slug,
        publishedAt: cv.publishedAt,
        publishedRevisionId: cv.publishedRevisionId,
      };
    },
    getSupportedSchemas: supportedSchemas,
    exportCvRevision: (cvId, revisionId, adapter, adapterVersion) => (
      cvWorkspace.exportRevision(cvId, revisionId, { adapter, adapterVersion })
    ),
  };
}

export function useMcpReadService() {
  const event = useEvent();
  return createMcpReadService({
    client: event.context.supabase,
    user: event.context.user,
  });
}

export async function runMcpRead(read) {
  try {
    return mcpReadResult(await read(useMcpReadService()));
  } catch (cause) {
    if (cause?.statusCode) throw cause;
    const code = cause?.code || "repository-error";
    throw createError({
      statusCode: statusForCode(code),
      statusMessage: cause?.message || "The Resume Studio read failed.",
      data: { code, ...(cause?.context ? { context: cause.context } : {}) },
      cause,
    });
  }
}

export function mcpJsonResource(uri, data) {
  return {
    contents: [{
      uri: uri.toString(),
      mimeType: "application/json",
      text: JSON.stringify({ schemaVersion: MCP_READ_SCHEMA_VERSION, data }),
    }],
  };
}
