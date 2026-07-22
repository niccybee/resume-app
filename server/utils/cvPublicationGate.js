const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const unavailable = {
  allowed: false,
  status: 503,
  message: "CV publication status is temporarily unavailable.",
};

const unpublished = {
  allowed: false,
  status: 404,
  message: "CV is not published.",
};

export function staticArtifactMatchesRevision(html, revisionId) {
  if (typeof html !== "string" || !revisionId) return false;
  const match = html.match(/<meta\s+name=["']cv-revision["']\s+content=["']([^"']+)["']\s*\/?\s*>/i);
  return match?.[1] === revisionId;
}

export function createPublicationGate({
  supabaseUrl,
  publishableKey,
  fetchImpl = fetch,
}) {
  return async function verifyPublication(slug) {
    if (!slugPattern.test(slug)) return unpublished;
    if (!supabaseUrl || !publishableKey) return unavailable;

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
      return unavailable;
    }

    if (!response.ok) return unavailable;

    let document;
    try {
      document = await response.json();
    } catch {
      return unavailable;
    }

    if (!document || document.status !== "published" || document.slug !== slug || !document.revisionId) {
      return unpublished;
    }

    return { allowed: true, status: 200, revisionId: document.revisionId };
  };
}
