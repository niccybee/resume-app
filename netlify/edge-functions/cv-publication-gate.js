function message(body, status) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export function createPublicationGate({ supabaseUrl, publishableKey, fetchImpl = fetch }) {
  return async function publicationGate(request, context) {
    if (!supabaseUrl || !publishableKey) {
      return message("CV publication status is temporarily unavailable.", 503);
    }
    const segments = new URL(request.url).pathname.split("/").filter(Boolean);
    const slug = segments[0] === "cv" && segments.length === 2
      ? decodeURIComponent(segments[1])
      : "";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return message("CV is not published.", 404);
    }

    let response;
    try {
      response = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/get_published_cv`, {
        method: "POST",
        headers: {
          apikey: publishableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_slug: slug }),
      });
    } catch {
      return message("CV publication status is temporarily unavailable.", 503);
    }
    if (!response.ok) {
      return message("CV publication status is temporarily unavailable.", 503);
    }
    const document = await response.json();
    if (!document || document.status !== "published" || document.slug !== slug) {
      return message("CV is not published.", 404);
    }
    return context.next();
  };
}

export default async function handler(request, context) {
  const env = globalThis.Netlify?.env;
  return createPublicationGate({
    supabaseUrl: env?.get("SUPABASE_URL") || env?.get("VITE_SUPABASE_URL"),
    publishableKey: env?.get("SUPABASE_PUBLISHABLE_KEY") || env?.get("VITE_SUPABASE_PUBLISHABLE_KEY"),
  })(request, context);
}
