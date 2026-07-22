import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { readMcpBodyLimited } from "./mcpBodyLimit";

describe("MCP raw body limit", () => {
  it("rejects a chunked body as soon as it crosses the memory ceiling", async () => {
    const request = new PassThrough();
    const body = readMcpBodyLimited(request, 300_000);
    request.write(Buffer.alloc(200_000));
    request.write(Buffer.alloc(100_001));

    await expect(body).rejects.toMatchObject({
      code: "payload-too-large",
      statusCode: 413,
    });
    expect(request[Symbol.for("h3RawBody")]).toBe(body);
  });

  it("uses the H3 cached request body when the Node stream is already unavailable", async () => {
    const request = new PassThrough();
    request.end();
    const event = {
      _requestBody: Buffer.from('{"jsonrpc":"2.0"}'),
      node: { req: request },
    };

    await expect(readMcpBodyLimited(event, 300_000))
      .resolves.toEqual(Buffer.from('{"jsonrpc":"2.0"}'));
    expect(request[Symbol.for("h3RawBody")]).toBe(event._requestBody);
  });

  it("bounds a Web request stream supplied by the Netlify adapter", async () => {
    const request = new PassThrough();
    request.destroy();
    const event = {
      node: { req: request },
      web: {
        request: {
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(Buffer.alloc(200_000));
              controller.enqueue(Buffer.alloc(100_001));
              controller.close();
            },
          }),
        },
      },
    };

    await expect(readMcpBodyLimited(event, 300_000)).rejects.toMatchObject({
      code: "payload-too-large",
      statusCode: 413,
    });
  });

  it("prefers a readable Node body and restores the Web Request for the MCP transport", async () => {
    const request = new PassThrough();
    const originalWebRequest = new Request("http://localhost/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"source":"stale-web-stream"}',
      duplex: "half",
    });
    const event = {
      node: { req: request },
      web: { request: originalWebRequest },
    };
    const body = readMcpBodyLimited(event, 300_000);
    request.end(Buffer.from('{"source":"node-stream"}'));

    await expect(body).resolves.toEqual(Buffer.from('{"source":"node-stream"}'));
    expect(event.web.request).not.toBe(originalWebRequest);
    await expect(event.web.request.text()).resolves.toBe('{"source":"node-stream"}');
  });

  it("creates the MCP transport Request when H3 has not created a Web request yet", async () => {
    const request = new PassThrough();
    request.method = "POST";
    request.url = "/mcp";
    request.headers = {
      host: "localhost:3000",
      "content-type": "application/json",
    };
    const event = { method: "POST", node: { req: request } };
    const body = readMcpBodyLimited(event, 300_000);
    request.end(Buffer.from('{"source":"node-stream"}'));

    await expect(body).resolves.toEqual(Buffer.from('{"source":"node-stream"}'));
    expect(event.web.request).toBeInstanceOf(Request);
    await expect(event.web.request.text()).resolves.toBe('{"source":"node-stream"}');
  });
});
