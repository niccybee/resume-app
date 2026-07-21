import { describe, expect, it, vi } from "vitest";
import { createPublicationGate } from "../netlify/edge-functions/cv-publication-gate.js";

describe("static CV publication gate", () => {
  it("serves the static artifact only while the curated contract is published", async () => {
    const next = vi.fn().mockResolvedValue(new Response("static cv", { status: 200 }));
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      slug: "product-lead",
      status: "published",
    }), { status: 200 }));
    const gate = createPublicationGate({
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-key",
      fetchImpl,
    });

    const response = await gate(
      new Request("https://resume.example/cv/product-lead"),
      { next },
    );

    expect(response.status).toBe(200);
    expect(next).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://project.supabase.co/rest/v1/rpc/get_published_cv",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ apikey: "publishable-key" }),
        body: JSON.stringify({ p_slug: "product-lead" }),
      }),
    );
  });

  it("blocks a withdrawn static artifact immediately", async () => {
    const next = vi.fn();
    const gate = createPublicationGate({
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-key",
      fetchImpl: vi.fn().mockResolvedValue(new Response("null", { status: 200 })),
    });

    const response = await gate(
      new Request("https://resume.example/cv/withdrawn"),
      { next },
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toContain("CV is not published");
    expect(next).not.toHaveBeenCalled();
  });

  it("fails closed when publication status cannot be verified", async () => {
    const next = vi.fn();
    const gate = createPublicationGate({
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-key",
      fetchImpl: vi.fn().mockResolvedValue(new Response("upstream failure", { status: 500 })),
    });

    const response = await gate(
      new Request("https://resume.example/cv/product-lead"),
      { next },
    );

    expect(response.status).toBe(503);
    expect(next).not.toHaveBeenCalled();
  });
});
