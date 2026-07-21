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
});
