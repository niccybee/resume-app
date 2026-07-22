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
import { sanitizeMcpErrorContext } from "./mcpResponseSafety";

export const MAX_MCP_READ_BYTES = 1_000_000;

export function mcpReadResult(data) {
  const structuredContent = readEnvelope(data);
  const text = JSON.stringify(structuredContent);
  if (Buffer.byteLength(text, "utf8") > MAX_MCP_READ_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: "The MCP read result is too large. Narrow the request.",
      data: { code: "response-too-large" },
    });
  }
  return {
    structuredContent,
    content: [{ type: "text", text }],
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

  function cvMetadata(cv) {
    return {
      id: cv.id,
      name: cv.name,
      status: cv.status,
      slug: cv.slug,
      publishedAt: cv.publishedAt,
      publishedRevisionId: cv.publishedRevisionId,
    };
  }

  async function listCvs(options = {}) {
    const cvs = await cvWorkspace.list(options);
    return cvs.map(cvMetadata);
  }

  async function getCv(cvId) {
    const cv = await cvWorkspace.get(cvId);
    if (!cv) throw createError({ statusCode: 404, statusMessage: "CV not found.", data: { code: "not-found" } });
    return cvMetadata(cv);
  }

  return {
    listCvs,
    getCv,
    listCvRevisions: async (cvId, options) => (await cvWorkspace.history(cvId, options))
      .map((revision) => ({
        id: revision.id,
        cvId: revision.cvId,
        number: revision.number,
        baseRevisionId: revision.baseRevisionId,
        baseRevisionNumber: revision.baseRevisionNumber,
        createdAt: revision.createdAt,
      })),
    getCvRevision: (cvId, revisionId) => cvWorkspace.revision(cvId, revisionId),
    listEditingSessions: async (cvId, options) => (await cvWorkspace.editingSessions(cvId, options))
      .map((session) => ({
        id: session.id,
        cvId: session.cvId,
        baseRevisionId: session.baseRevisionId,
        baseRevisionNumber: session.baseRevisionNumber,
        status: session.status,
        optimisticVersion: session.optimisticVersion,
        finishedRevisionId: session.finishedRevisionId,
        revisionNumber: session.revisionNumber,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        finishedAt: session.finishedAt,
      })),
    getEditingSession: (sessionId) => cvWorkspace.resumeEditingSession(sessionId),
    listCvBlocks: async (query) => (await blockLibrary.browse({
      ...query,
      versionHistoryLimit: 1,
    })).blocks,
    getCvBlock: (blockId) => blockLibrary.getBlock(blockId, { versionHistoryLimit: 100 }),
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
      data: {
        code,
        ...(cause?.context ? { context: sanitizeMcpErrorContext(cause.context) } : {}),
      },
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
