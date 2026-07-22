import { readEnvelope } from "../../src/domain/mcp/readContracts";
import { sanitizeMcpChangeResponse } from "./mcpResponseSafety";

export const MAX_MCP_MUTATION_INPUT_BYTES = 256_000;
export const MAX_MCP_CHANGE_RESULT_BYTES = 1_000_000;

class McpPayloadSizeError extends Error {
  constructor(message) {
    super(message);
    this.name = "McpPayloadSizeError";
    this.code = "payload-too-large";
    this.statusCode = 413;
    this.data = { code: this.code };
  }
}

function jsonSize(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

export function assertMcpMutationInputSize(input) {
  if (jsonSize(input) > MAX_MCP_MUTATION_INPUT_BYTES) {
    throw new McpPayloadSizeError("The MCP mutation request is too large. Split it into smaller proposals.");
  }
}

export function mcpChangeResult(data) {
  const structuredContent = readEnvelope(sanitizeMcpChangeResponse(data));
  const text = JSON.stringify(structuredContent);
  if (Buffer.byteLength(text, "utf8") > MAX_MCP_CHANGE_RESULT_BYTES) {
    throw new McpPayloadSizeError("The MCP change result is too large. Narrow the proposal.");
  }
  return {
    structuredContent,
    content: [{ type: "text", text }],
  };
}
