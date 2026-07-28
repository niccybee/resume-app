import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const fromRoot = (path) => resolve(root, path);

describe("public MCP setup guide", () => {
  it("explains the connection and review gate in plain language", async () => {
    const guide = await readFile(fromRoot("app/pages/docs/mcp.vue"), "utf8");
    const plainText = guide.replace(/\s+/g, " ");

    expect(plainText).toContain("MCP is a secure connection between Resume Studio and an AI chat app");
    expect(plainText).toContain("Nothing is added to a CV until you review and apply it");
    expect(guide).toContain("Turn on the connection in Resume Studio");
    expect(guide).toContain('to="/app/settings/mcp"');
  });

  it("covers ChatGPT, Codex, OpenCode, and Claude without leading with configuration", async () => {
    const guide = await readFile(fromRoot("app/pages/docs/mcp.vue"), "utf8");

    expect(guide).toContain('id="chatgpt"');
    expect(guide).toContain('id="codex"');
    expect(guide).toContain('id="opencode"');
    expect(guide).toContain('id="claude"');
    expect(guide).toContain("Show the OpenCode technical steps");
    expect(guide).toContain("<UCollapsible");
    expect(guide.indexOf("Add Resume Studio to OpenCode")).toBeLessThan(guide.indexOf("opencode.json"));
    expect(guide).toContain("https://cv.obair.tech/mcp");
    expect(guide).toContain('document.execCommand("copy")');
  });

  it("offers one portable Resume Studio skill package", async () => {
    const guide = await readFile(fromRoot("app/pages/docs/mcp.vue"), "utf8");

    expect(guide).toContain("/downloads/resume-studio-skill.zip");
    expect(guide).toContain("-a codex opencode claude-code -s resume-studio");
    expect(guide).toContain("The skill does not replace the connection");
  });

  it("is discoverable from the public header and authenticated MCP settings", async () => {
    const [docsIndex, header, settings] = await Promise.all([
      readFile(fromRoot("app/pages/docs/index.vue"), "utf8"),
      readFile(fromRoot("app/components/PublicSiteHeader.vue"), "utf8"),
      readFile(fromRoot("src/views/McpSettings.vue"), "utf8"),
    ]);

    expect(docsIndex).toContain('to="/docs/mcp"');
    expect(docsIndex).toContain('label="Open the MCP guide"');
    expect(header).toContain('to="/docs"');
    expect(header).toContain('label="Docs"');
    expect(header).toContain("CV / OBAIR");
    expect(header).not.toContain("NicBenson.com.au");
    expect(settings).toContain('to="/docs/mcp"');
    expect(settings).toContain('label="Read the setup guide"');
  });
});
