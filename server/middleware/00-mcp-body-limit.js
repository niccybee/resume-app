import {
  createError,
  defineEventHandler,
  getHeader,
  getRequestURL,
} from "h3";
import { readMcpBodyLimited } from "../utils/mcpBodyLimit";

export const MAX_MCP_REQUEST_BYTES = 300_000;

export default defineEventHandler(async (event) => {
  if (getRequestURL(event).pathname !== "/mcp" || event.method !== "POST") return;
  const contentLength = Number(getHeader(event, "content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_MCP_REQUEST_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: "The MCP request body is too large.",
      data: { code: "payload-too-large" },
    });
  }
  try {
    await readMcpBodyLimited(event.node.req, MAX_MCP_REQUEST_BYTES);
  } catch (cause) {
    if (cause?.statusCode !== 413) throw cause;
    throw createError({
      statusCode: cause.statusCode,
      statusMessage: cause.message,
      data: { code: cause.code },
    });
  }
});
