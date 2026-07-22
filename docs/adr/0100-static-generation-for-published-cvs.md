# Generate static snapshots for published CVs

Published CV links are unlisted documents: they need fast, resilient delivery and
printable HTML, but must not be indexed or made enumerable. Publication changes
are infrequent enough that deployment latency is acceptable; withdrawal must
prevent access immediately and must remove the snapshot from the next artifact.

We generate one standalone HTML file at `/cv/<slug>/index.html` before each
Nuxt production build. The staged `.generated/public/cv` directory is registered
as a Nitro server asset so Nuxt can serve the snapshots only after its publication
gate succeeds. The build uses a server-only Supabase service-role key to call a
service-role-only slug-manifest function, then reads each document through the
curated `get_published_cv` contract. Every run deletes the previous generated
`.generated/public/cv` tree before writing the current published set. Static pages retain
`noindex, nofollow, noarchive`, escape all user content, contain no Supabase
credential or private record, and work without client JavaScript.

A native Nuxt server route checks the curated public contract before reading a
generated `/cv/<slug>` snapshot. It fails closed when status cannot be verified and
returns 404 as soon as publication is withdrawn, so a stale deployment artifact
cannot expose unpublished content or bypass the gate as a public asset. A newly
generated snapshot becomes available with the next deployment. The deployment
environment must provide
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and the server-only
`SUPABASE_SERVICE_ROLE_KEY`; production builds fail closed when they are absent.
A server-held build hook may reduce publication-to-snapshot latency, but it is not
part of the privacy boundary.

We rejected an anonymous published-slug API because it would make unlisted links
enumerable. We rejected client-only dynamic rendering as the final delivery path
because it delays meaningful content and depends on JavaScript for every view. We
rejected request-time server rendering because it does not satisfy the static
generation decision and adds runtime rendering. The small request-time publication
gate is retained solely to enforce immediate withdrawal and does not render CV
content.
