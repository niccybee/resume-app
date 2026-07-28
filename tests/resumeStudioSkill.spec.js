import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const fromRoot = (path) => resolve(root, path);

describe("portable Resume Studio skill", () => {
  it("declares a concise portable skill and the explicit apply boundary", async () => {
    const skill = await readFile(fromRoot("skills/resume-studio/SKILL.md"), "utf8");

    expect(skill).toMatch(/^---\nname: resume-studio\ndescription: .+\n---/);
    expect(skill).not.toContain("TODO");
    expect(skill).toContain("Never create and apply a proposal in one uninterrupted step");
    expect(skill).toContain("get_supported_schemas");
    expect(skill).toContain("references/client-setup.md");
  });

  it("declares the Resume Studio MCP dependency for OpenAI clients", async () => {
    const metadata = await readFile(
      fromRoot("skills/resume-studio/agents/openai.yaml"),
      "utf8",
    );

    expect(metadata).toContain('display_name: "Resume Studio"');
    expect(metadata).toContain('type: "mcp"');
    expect(metadata).toContain('url: "https://cv.obair.tech/mcp"');
  });

  it("ships the domain, tool, response, and client references", async () => {
    const references = await Promise.all([
      "domain-contract.md",
      "tool-map.md",
      "response-frameworks.md",
      "client-setup.md",
    ].map((name) => readFile(
      fromRoot(`skills/resume-studio/references/${name}`),
      "utf8",
    )));

    expect(references.every((reference) => reference.length > 200)).toBe(true);
    expect(references.join("\n")).toContain("propose_update_cv_block");
    expect(references.join("\n")).toContain("Apply proposal <proposal ID>");
  });

  it("publishes an uploadable ZIP with the canonical skill files", async () => {
    const archivePath = fromRoot("public/downloads/resume-studio-skill.zip");
    const archive = await readFile(archivePath);
    const archiveText = archive.toString("latin1");
    const archiveStat = await stat(archivePath);

    expect(archiveStat.size).toBeGreaterThan(1000);
    expect(archiveText).toContain("SKILL.md");
    expect(archiveText).toContain("agents/openai.yaml");
    expect(archiveText).toContain("references/domain-contract.md");
  });
});
