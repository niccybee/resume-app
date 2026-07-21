import { createPublicationGate, staticArtifactMatchesRevision } from "../../utils/cvPublicationGate";

function protectResponse(event) {
  setHeader(event, "Cache-Control", "no-store");
  setHeader(event, "X-Robots-Tag", "noindex, nofollow, noarchive");
}

function respondWithText(event, body, status) {
  setResponseStatus(event, status);
  setHeader(event, "Content-Type", "text/plain; charset=utf-8");
  return body;
}

export default defineEventHandler(async (event) => {
  protectResponse(event);

  const config = useRuntimeConfig(event);
  const slug = getRouterParam(event, "slug") || "";
  const verifyPublication = createPublicationGate({
    supabaseUrl: config.publicationSupabaseUrl,
    publishableKey: config.publicationSupabasePublishableKey,
  });
  const publication = await verifyPublication(slug);

  if (!publication.allowed) {
    return respondWithText(event, publication.message, publication.status);
  }

  const html = await useStorage("assets:static-cvs").getItem(`${slug}/index.html`);
  if (typeof html !== "string") {
    return respondWithText(event, "CV is not published.", 404);
  }
  if (!staticArtifactMatchesRevision(html, publication.revisionId)) {
    return respondWithText(event, "CV publication is being refreshed.", 503);
  }

  setHeader(event, "Content-Type", "text/html; charset=utf-8");
  return html;
});
