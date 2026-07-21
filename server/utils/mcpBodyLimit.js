const RAW_BODY = Symbol.for("h3RawBody");

class McpRequestSizeError extends Error {
  constructor() {
    super("The MCP request body is too large.");
    this.name = "McpRequestSizeError";
    this.code = "payload-too-large";
    this.statusCode = 413;
  }
}

export function readMcpBodyLimited(request, maximumBytes) {
  if (request[RAW_BODY]) return request[RAW_BODY];
  if (Buffer.isBuffer(request.rawBody)) {
    if (request.rawBody.byteLength > maximumBytes) {
      return Promise.reject(new McpRequestSizeError());
    }
    return Promise.resolve(request.rawBody);
  }

  const body = new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    let settled = false;

    function cleanup() {
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("error", onError);
    }
    function onData(chunk) {
      bytes += chunk.byteLength;
      if (bytes > maximumBytes) {
        settled = true;
        chunks.length = 0;
        cleanup();
        request.resume();
        reject(new McpRequestSizeError());
        return;
      }
      chunks.push(chunk);
    }
    function onEnd() {
      cleanup();
      if (!settled) resolve(Buffer.concat(chunks));
    }
    function onError(cause) {
      cleanup();
      if (!settled) reject(cause);
    }

    request.on("data", onData);
    request.on("end", onEnd);
    request.on("error", onError);
  });
  request[RAW_BODY] = body;
  return body;
}
