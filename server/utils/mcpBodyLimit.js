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
  const event = request?.node?.req ? request : null;
  const nodeRequest = event?.node?.req || request;
  if (nodeRequest[RAW_BODY]) return nodeRequest[RAW_BODY];

  const cachedBody = event && (
    event._requestBody ??
    nodeRequest.rawBody ??
    nodeRequest.body
  );
  let limitedBody;
  if (cachedBody != null) {
    limitedBody = Promise.resolve(cachedBody)
      .then((source) => readLimitedSource(source, maximumBytes));
  } else if (isReadableNodeStream(nodeRequest)) {
    limitedBody = readLimitedNodeStream(nodeRequest, maximumBytes);
  } else if (event?.web?.request?.body) {
    limitedBody = readLimitedWebStream(event.web.request.body, maximumBytes);
  } else {
    limitedBody = Promise.resolve(Buffer.alloc(0));
  }

  const body = limitedBody.then((buffer) => {
    restoreWebRequest(event, buffer);
    return buffer;
  });

  nodeRequest[RAW_BODY] = body;
  if (event) event._requestBody = body;
  return body;
}

function isReadableNodeStream(request) {
  return typeof request?.on === "function" &&
    request.readableEnded !== true &&
    request.destroyed !== true;
}

function restoreWebRequest(event, body) {
  if (!event) return;
  const nodeRequest = event.node.req;
  const original = event.web?.request ||
    (event.req instanceof Request ? event.req : null);
  const method = original?.method || event.method || nodeRequest.method || "POST";
  const headers = original?.headers || new Headers(
    Object.entries(nodeRequest.headers || {}).flatMap(([key, value]) =>
      value == null ? [] : [[key, Array.isArray(value) ? value.join(", ") : String(value)]],
    ),
  );
  const protocol = String(nodeRequest.headers?.["x-forwarded-proto"] ||
    (nodeRequest.socket?.encrypted ? "https" : "http")).split(",")[0].trim();
  const host = nodeRequest.headers?.host || "localhost";
  const url = original?.url || new URL(nodeRequest.url || "/", `${protocol}://${host}`).href;
  const replacement = new Request(url, {
    method,
    headers,
    body,
    duplex: "half",
  });
  event.web ||= {};
  event.web.request = replacement;
}

function assertLimited(buffer, maximumBytes) {
  if (buffer.byteLength > maximumBytes) throw new McpRequestSizeError();
  return buffer;
}

function readLimitedSource(source, maximumBytes) {
  if (Buffer.isBuffer(source)) return assertLimited(source, maximumBytes);
  if (typeof source === "string") {
    return assertLimited(Buffer.from(source), maximumBytes);
  }
  if (source instanceof URLSearchParams) {
    return assertLimited(Buffer.from(source.toString()), maximumBytes);
  }
  if (typeof source?.getReader === "function") {
    return readLimitedWebStream(source, maximumBytes);
  }
  if (typeof source?.on === "function") {
    return readLimitedNodeStream(source, maximumBytes);
  }
  return assertLimited(Buffer.from(JSON.stringify(source)), maximumBytes);
}

async function readLimitedWebStream(stream, maximumBytes) {
  const reader = stream.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks);
      const chunk = Buffer.from(value);
      bytes += chunk.byteLength;
      if (bytes > maximumBytes) {
        await reader.cancel();
        throw new McpRequestSizeError();
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
}

function readLimitedNodeStream(request, maximumBytes) {
  return new Promise((resolve, reject) => {
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
}
