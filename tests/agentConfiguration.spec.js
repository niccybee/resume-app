import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readRepositoryFile(path) {
  return readFileSync(resolve(repositoryRoot, path), "utf8");
}

describe("repository agent configuration", () => {
  it("publishes the agreed engineering-agent conventions through one discoverable contract", () => {
    const guidance = readRepositoryFile("AGENTS.md");
    const issueTracker = readRepositoryFile("docs/agents/issue-tracker.md");
    const triageLabels = readRepositoryFile("docs/agents/triage-labels.md");
    const domainDocs = readRepositoryFile("docs/agents/domain.md");

    expect(guidance.match(/^## Agent skills$/gm)).toHaveLength(1);
    expect(guidance).toContain("docs/agents/issue-tracker.md");
    expect(guidance).toContain("docs/agents/triage-labels.md");
    expect(guidance).toContain("docs/agents/domain.md");

    expect(issueTracker).toContain("# Issue tracker: GitHub");
    expect(issueTracker).toContain("PRs as a request surface: no.");

    for (const label of [
      "needs-triage",
      "needs-info",
      "ready-for-agent",
      "ready-for-human",
      "wontfix",
    ]) {
      const mapping = triageLabels
        .split("\n")
        .find((line) => line.includes("`" + label + "`"));
      const mappedLabels = mapping?.match(/`[^`]+`/g);

      expect(mappedLabels?.slice(0, 2)).toEqual([
        "`" + label + "`",
        "`" + label + "`",
      ]);
    }

    expect(domainDocs).toContain("Single-context repo (most repos):");
    expect(domainDocs).toContain("**`CONTEXT.md`** at the repo root");
    expect(domainDocs).toContain("**`docs/adr/`**");
    expect(domainDocs).toContain("**proceed silently**");
  });
});
