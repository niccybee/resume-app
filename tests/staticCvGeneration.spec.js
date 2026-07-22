import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateStaticCvs } from "../scripts/static-cvs.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })));
});

describe("published CV static generation", () => {
  it("writes only current published slugs as escaped noindex HTML", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "resume-static-cvs-"));
    temporaryDirectories.push(outDir);
    const document = {
      id: "cv-1",
      name: "Product <Lead>",
      slug: "product-lead",
      status: "published",
      revisionId: "revision-2",
      profile: {
        basics: {
          name: "Nic & Co",
          label: "Product Lead",
          email: "nic@example.com",
          url: "javascript:alert('static-xss')",
        },
      },
      summary: "Builds <trusted> products.",
      selections: [{
        blockId: "block-1",
        versionId: "version-1",
        section: "experience",
        order: 0,
        content: { text: "Shipped & scaled the platform." },
        group: {
          employerId: "e2",
          employer: "E2",
          occasionId: "e2-product-2024",
          role: "Product Lead",
          startDate: "2024-02",
          endDate: "present",
        },
      }],
    };
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/list_published_cv_slugs_for_build")) {
        return new Response(JSON.stringify([{ slug: "product-lead" }]), { status: 200 });
      }
      return new Response(JSON.stringify(document), { status: 200 });
    });

    const result = await generateStaticCvs({
      outDir,
      supabaseUrl: "https://project.supabase.co",
      serviceRoleKey: "server-only-key",
      fetchImpl,
    });

    expect(result).toEqual({ generated: ["product-lead"] });
    const html = await readFile(join(outDir, "cv", "product-lead", "index.html"), "utf8");
    expect(html).toContain('<meta name="robots" content="noindex, nofollow, noarchive">');
    expect(html).toContain('<meta name="cv-revision" content="revision-2">');
    expect(html).toContain("Nic &amp; Co");
    expect(html).toContain("Builds &lt;trusted&gt; products.");
    expect(html).toContain("Shipped &amp; scaled the platform.");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("server-only-key");
  });

  it("removes withdrawn CV artifacts on the next generation run", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "resume-static-cvs-"));
    temporaryDirectories.push(outDir);
    const published = vi.fn(async (url) => {
      if (url.endsWith("/list_published_cv_slugs_for_build")) {
        return new Response(JSON.stringify([{ slug: "withdraw-me" }]), { status: 200 });
      }
      return new Response(JSON.stringify({
        name: "Withdraw me",
        slug: "withdraw-me",
        status: "published",
        revisionId: "revision-1",
        profile: { basics: {} },
        selections: [],
      }), { status: 200 });
    });
    await generateStaticCvs({
      outDir,
      supabaseUrl: "https://project.supabase.co",
      serviceRoleKey: "server-only-key",
      fetchImpl: published,
    });

    await generateStaticCvs({
      outDir,
      supabaseUrl: "https://project.supabase.co",
      serviceRoleKey: "server-only-key",
      fetchImpl: vi.fn().mockResolvedValue(new Response("[]", { status: 200 })),
    });

    await expect(access(join(outDir, "cv", "withdraw-me", "index.html"))).rejects.toThrow();
  });
});
