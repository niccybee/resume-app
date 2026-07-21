import { describe, expect, it, vi } from "vitest";
import { createPublicationGate, staticArtifactMatchesRevision } from "../server/utils/cvPublicationGate.js";

describe("static CV publication gate", () => {
  it("serves the static artifact only while the curated contract is published", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      slug: "product-lead",
      status: "published",
      revisionId: "revision-2",
    }), { status: 200 }));
    const gate = createPublicationGate({
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-key",
      fetchImpl,
    });

    const result = await gate("product-lead");

    expect(result).toEqual({ allowed: true, status: 200, revisionId: "revision-2" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://project.supabase.co/rest/v1/rpc/get_published_cv",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ apikey: "publishable-key" }),
        body: JSON.stringify({ p_slug: "product-lead" }),
      }),
    );
  });

  it("fails closed when a static artifact does not match the live pinned Revision", () => {
    const revision2 = '<html><head><meta name="cv-revision" content="revision-2"></head></html>';
    expect(staticArtifactMatchesRevision(revision2, "revision-2")).toBe(true);
    expect(staticArtifactMatchesRevision(revision2, "revision-1")).toBe(false);
    expect(staticArtifactMatchesRevision("<html></html>", "revision-2")).toBe(false);
  });

  it("blocks a withdrawn static artifact immediately", async () => {
    const gate = createPublicationGate({
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-key",
      fetchImpl: vi.fn().mockResolvedValue(new Response("null", { status: 200 })),
    });

    const result = await gate("withdrawn");

    expect(result).toEqual({
      allowed: false,
      status: 404,
      message: "CV is not published.",
    });
  });

  it("fails closed when publication status cannot be verified", async () => {
    const gate = createPublicationGate({
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-key",
      fetchImpl: vi.fn().mockResolvedValue(new Response("upstream failure", { status: 500 })),
    });

    const result = await gate("product-lead");

    expect(result).toEqual({
      allowed: false,
      status: 503,
      message: "CV publication status is temporarily unavailable.",
    });
  });

  it("rejects malformed slugs without calling Supabase", async () => {
    const fetchImpl = vi.fn();
    const gate = createPublicationGate({
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-key",
      fetchImpl,
    });

    await expect(gate("../private")).resolves.toEqual({
      allowed: false,
      status: 404,
      message: "CV is not published.",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
