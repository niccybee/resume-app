import { createError } from "h3";
import { useEvent } from "nitropack/runtime";
import { createBlockLibrary } from "../../src/domain/blocks/blockLibrary";
import { createCvWorkspace } from "../../src/domain/cvs/createCvWorkspace";
import { createSupabaseBlockRepository } from "../../src/infrastructure/blocks/createSupabaseBlockRepository";
import { createSupabaseCvRepository } from "../../src/infrastructure/cvs/createSupabaseCvRepository";
import {
  sanitizeMcpErrorContext,
} from "./mcpResponseSafety";
import { mcpChangeResult } from "./mcpPayloadSafety";

function statusForCode(code) {
  if (code === "authentication-required") return 401;
  if (["not-found", "block-not-found", "version-not-found"].includes(code)) return 404;
  if (["stale-proposal", "stale-block-version", "session-conflict"].includes(code)) return 409;
  if (["repository-error"].includes(code)) return 503;
  return 400;
}

export function createMcpChangeService({ client, user, oauthClient }) {
  const getActor = async () => user;
  const blockRepository = createSupabaseBlockRepository({ client, getActor });
  const blockLibrary = createBlockLibrary({ repository: blockRepository });
  const cvWorkspace = createCvWorkspace({
    repository: createSupabaseCvRepository({ client, getActor }),
    blockLibrary,
  });

  return {
    proposeContentChanges: (input) => cvWorkspace.proposeContentChanges({
      ...input,
      operations: input.operations.map((operation) => (
        operation.type === "append_block_version"
          ? {
              ...operation,
              source: {
                type: "mcp",
                clientId: oauthClient?.id || oauthClient?.client_id || "unknown-client",
              },
            }
          : operation
      )),
    }),
    proposeLifecycleChange: (input) => cvWorkspace.proposeLifecycleChange(input),
    applyChangeProposal: (proposalId) => cvWorkspace.applyChangeProposal(proposalId),
    discardChangeProposal: (proposalId) => cvWorkspace.discardChangeProposal(proposalId),
  };
}

export function useMcpChangeService() {
  const event = useEvent();
  return createMcpChangeService({
    client: event.context.supabase,
    user: event.context.user,
    oauthClient: event.context.oauthClient,
  });
}

export async function runMcpChange(change) {
  try {
    return mcpChangeResult(await change(useMcpChangeService()));
  } catch (cause) {
    if (cause?.statusCode) throw cause;
    const code = cause?.code || "repository-error";
    throw createError({
      statusCode: statusForCode(code),
      statusMessage: cause?.message || "The Resume Studio change failed.",
      data: {
        code,
        ...(cause?.context ? { context: sanitizeMcpErrorContext(cause.context) } : {}),
      },
    });
  }
}
