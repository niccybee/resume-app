# Generate static snapshots for published CVs

Published CV links are unlisted documents: they need fast, resilient delivery and
printable HTML, but must not be indexed or made enumerable. Publication changes
are infrequent enough that deployment latency is acceptable; withdrawal must
remove the snapshot promptly and must never leave private content in a later
artifact.

We will generate one standalone HTML file at `/cv/<slug>/index.html` during each
production build. The build uses a server-only Supabase service-role key to call a
service-role-only slug-manifest function, then reads each document through the
curated `get_published_cv` contract. Every run deletes the previous generated
`dist/cv` tree before writing the current published set. A withdrawn CV therefore
disappears on the next deployment. Static pages retain `noindex, nofollow,
noarchive`, escape all user content, contain no Supabase credential or private
record, and work without client JavaScript.

The deployment environment must provide `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`; production builds fail closed when they are absent.
Publication and withdrawal should invoke a server-held Netlify build hook so the
artifact follows the database state. Until that hook is configured, the workspace
must treat the database publication state as authoritative and operators must
redeploy after a publication change.

We rejected an anonymous published-slug API because it would make unlisted links
enumerable. We rejected client-only dynamic rendering as the final delivery path
because it delays meaningful content and depends on JavaScript and a live API for
every view. We rejected request-time server rendering because it improves first
paint but does not satisfy the static-generation decision and adds a runtime
compute dependency. The dynamic curated route remains the local-development and
pre-deployment fallback, and it continues to enforce withdrawal immediately while
a static redeploy is pending.
