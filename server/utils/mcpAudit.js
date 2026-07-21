const IDENTITY_FIELDS = {
  proposalId: "proposalIds",
  cvId: "cvIds",
  blockId: "blockIds",
  versionId: "versionIds",
  basedOnVersionId: "versionIds",
  currentVersionId: "versionIds",
  revisionId: "revisionIds",
  baseRevisionId: "revisionIds",
  publishedRevisionId: "revisionIds",
  editingSessionId: "editingSessionIds",
};
const TARGET_TYPES = {
  cv: "cvIds",
  cv_block: "blockIds",
  block_version: "versionIds",
  cv_revision: "revisionIds",
  editing_session: "editingSessionIds",
};
const OUTPUT_ORDER = [
  "proposalIds",
  "cvIds",
  "blockIds",
  "versionIds",
  "revisionIds",
  "editingSessionIds",
];

function safeId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 512
    ? value
    : null;
}

function safeTargetId(value) {
  const id = safeId(value);
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

export function collectMcpTargetIdentities(...sources) {
  const collected = Object.fromEntries(OUTPUT_ORDER.map((key) => [key, new Set()]));

  function add(key, value) {
    const values = Array.isArray(value) ? value : [value];
    for (const candidate of values) {
      const id = safeTargetId(candidate);
      if (id && collected[key].size < 100) collected[key].add(id);
    }
  }

  function addDirectIdentities(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    if (safeTargetId(value.id) && TARGET_TYPES[value.type]) add(TARGET_TYPES[value.type], value.id);
    if (safeTargetId(value.id) && (value.operationType || Array.isArray(value.operations))) {
      add("proposalIds", value.id);
    }
    for (const [field, output] of Object.entries(IDENTITY_FIELDS)) {
      if (safeTargetId(value[field])) add(output, value[field]);
    }
  }

  function inspectOperation(operation) {
    if (!operation || typeof operation !== "object" || Array.isArray(operation)) return;
    addDirectIdentities(operation);
    addDirectIdentities(operation.target);
    addDirectIdentities(operation.source);
  }

  function inspect(source) {
    if (!source || typeof source !== "object" || Array.isArray(source)) return;
    addDirectIdentities(source);
    addDirectIdentities(source.target);
    addDirectIdentities(source.source);
    inspectOperation(source.operation);
    if (Array.isArray(source.operations)) source.operations.slice(0, 100).forEach(inspectOperation);
    if (source.affectedIdentities && typeof source.affectedIdentities === "object") {
      for (const key of OUTPUT_ORDER) add(key, source.affectedIdentities[key]);
    }
    if (source.result && typeof source.result === "object") {
      addDirectIdentities(source.result);
      if (source.result.affectedIdentities && typeof source.result.affectedIdentities === "object") {
        for (const key of OUTPUT_ORDER) add(key, source.result.affectedIdentities[key]);
      }
    }
  }

  sources.forEach(inspect);
  return Object.fromEntries(OUTPUT_ORDER
    .map((key) => [key, [...collected[key]]])
    .filter(([, values]) => values.length));
}

export class McpAuditError extends Error {
  constructor() {
    super("MCP audit persistence is temporarily unavailable.");
    this.name = "McpAuditError";
    this.code = "audit-unavailable";
    this.statusCode = 503;
  }
}

export async function recordMcpAuditEvent({
  client,
  actor,
  oauthClient,
  operation,
  input,
  output,
  result,
  errorCode = null,
  logger = console,
}) {
  const event = {
    actorId: safeId(actor?.id) || "unknown-actor",
    clientId: safeId(oauthClient?.id || oauthClient?.client_id) || "unknown-client",
    operation: String(operation || "unknown-operation").slice(0, 128),
    targetIdentities: collectMcpTargetIdentities(input, output),
    result,
    errorCode: errorCode ? String(errorCode).slice(0, 128) : null,
    occurredAt: new Date().toISOString(),
  };
  try {
    const { error } = await client.rpc("record_mcp_audit_event", {
      p_client_id: event.clientId,
      p_operation: event.operation,
      p_target_identities: event.targetIdentities,
      p_result: event.result,
      p_error_code: event.errorCode,
    });
    if (error) throw error;
  } catch {
    logger.error("MCP audit persistence failed", event);
    throw new McpAuditError();
  }
  return event;
}
