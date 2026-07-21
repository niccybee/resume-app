import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const endpoint = new URL(required("RESUME_STUDIO_MCP_URL"));
const accessToken = required("RESUME_STUDIO_MCP_ACCESS_TOKEN");
const cvId = required("RESUME_STUDIO_MCP_CV_ID");
const sourceSessionId = required("RESUME_STUDIO_MCP_SOURCE_SESSION_ID");
const baseOptimisticVersion = Number(required("RESUME_STUDIO_MCP_BASE_OPTIMISTIC_VERSION"));
if (!Number.isInteger(baseOptimisticVersion) || baseOptimisticVersion < 1) {
  throw new Error("RESUME_STUDIO_MCP_BASE_OPTIMISTIC_VERSION must be a positive integer.");
}
if (process.env.RESUME_STUDIO_MCP_CONFIRM_APPLY !== "copy-to-new-version") {
  throw new Error("Set RESUME_STUDIO_MCP_CONFIRM_APPLY=copy-to-new-version only after reviewing this non-destructive verification mutation.");
}
if (process.env.RESUME_STUDIO_MCP_CONFIRM_REVOKE !== "oauth-grant") {
  throw new Error("Set RESUME_STUDIO_MCP_CONFIRM_REVOKE=oauth-grant to confirm the verification client grant will be revoked at the end of this run.");
}

function accessTokenClaims() {
  try {
    return JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("RESUME_STUDIO_MCP_ACCESS_TOKEN must be a JWT issued by Supabase OAuth.");
  }
}

const claims = accessTokenClaims();
const supabaseUrl = new URL(claims.iss).origin;
const oauthClientId = required("RESUME_STUDIO_MCP_OAUTH_CLIENT_ID");
if (claims.client_id !== oauthClientId) {
  throw new Error("RESUME_STUDIO_MCP_OAUTH_CLIENT_ID does not match the access token client.");
}
const publishableKey = required("RESUME_STUDIO_SUPABASE_PUBLISHABLE_KEY");

function transport() {
  return new StreamableHTTPClientTransport(endpoint, {
    requestInit: { headers: { authorization: `Bearer ${accessToken}` } },
  });
}

let firstClient = new Client({ name: "Resume Studio release verification", version: "1.0.0" });
let reconnectedClient;
let revokedClient;
let grantRevoked = false;

async function revokeVerificationGrant() {
  const response = await fetch(`${supabaseUrl}/auth/v1/user/oauth/grants?client_id=${encodeURIComponent(oauthClientId)}`, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${accessToken}`,
      apikey: publishableKey,
    },
  });
  if (!response.ok) throw new Error("The OAuth grant could not be revoked.");
  grantRevoked = true;
}

try {
  await firstClient.connect(transport());
  const cvs = await firstClient.callTool({ name: "list_cvs", arguments: { limit: 100 } });
  if (!cvs.structuredContent?.data?.some((cv) => cv.id === cvId)) {
    throw new Error("The selected CV is not visible to this allow-listed connection.");
  }
  const sourceSessions = await firstClient.callTool({
    name: "list_editing_sessions",
    arguments: { cvId, limit: 100 },
  });
  const source = sourceSessions.structuredContent?.data?.find((session) => session.id === sourceSessionId);
  if (!source || source.status !== "open" || source.optimisticVersion !== baseOptimisticVersion) {
    throw new Error("The selected source Editing Session or optimistic version is stale.");
  }

  const proposal = await firstClient.callTool({
    name: "propose_lifecycle_change",
    arguments: {
      operation: {
        type: "copy_to_new_version",
        source: { type: "editing_session", id: sourceSessionId },
        baseOptimisticVersion,
      },
    },
  });
  const proposalData = proposal.structuredContent?.data;
  if (!proposalData?.id || proposalData.status !== "pending") {
    throw new Error("The server did not return a reviewable pending Change Proposal.");
  }

  const applied = await firstClient.callTool({
    name: "apply_change_proposal",
    arguments: { proposalId: proposalData.id },
  });
  const createdSessionId = applied.structuredContent?.data?.result?.editingSessionId;
  if (!createdSessionId) throw new Error("The applied Change Proposal did not return an Editing Session identity.");
  await firstClient.close();
  firstClient = null;

  reconnectedClient = new Client({ name: "Resume Studio release verification reconnect", version: "1.0.0" });
  await reconnectedClient.connect(transport());
  const persistedSessions = await reconnectedClient.callTool({
    name: "list_editing_sessions",
    arguments: { cvId, limit: 100 },
  });
  if (!persistedSessions.structuredContent?.data?.some((session) => session.id === createdSessionId)) {
    throw new Error("The copied Editing Session was not visible after reconnecting.");
  }
  const persistedSource = persistedSessions.structuredContent.data
    .find((session) => session.id === sourceSessionId);
  if (persistedSource?.status !== "open"
    || persistedSource.optimisticVersion !== baseOptimisticVersion) {
    throw new Error("Copy to New Version changed or closed the source Editing Session.");
  }

  await reconnectedClient.close();
  reconnectedClient = null;
  await revokeVerificationGrant();

  revokedClient = new Client({ name: "Resume Studio revoked-grant verification", version: "1.0.0" });
  let revokedGrantBlocked = false;
  try {
    await revokedClient.connect(transport());
  } catch {
    revokedGrantBlocked = true;
  }
  if (!revokedGrantBlocked) throw new Error("The revoked OAuth grant still connected to Resume Studio MCP.");

  console.log(JSON.stringify({
    verified: true,
    operation: "copy_to_new_version",
    cvId,
    sourceSessionId,
    createdSessionId,
    revokedGrantBlocked,
  }));
} finally {
  if (firstClient) await firstClient.close().catch(() => {});
  if (reconnectedClient) await reconnectedClient.close().catch(() => {});
  if (revokedClient) await revokedClient.close().catch(() => {});
  if (!grantRevoked) await revokeVerificationGrant();
}
