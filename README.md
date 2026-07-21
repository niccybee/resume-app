# Resume Studio

A Nuxt 4 workspace for maintaining versioned CV content, composing role-specific drafts, privately previewing them, and publishing unlisted public CV links from PRM2 Supabase.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add PRM2's publishable key. Never use a Supabase secret or service-role key in the browser.
3. Install with `ni`, start with `nr dev`, test with `nr test`, and build with `nr build`.

`nr test` provisions the pinned Playwright Chromium build before running the browser suite, so clean machines and CI use the same browser version.

The checked-in SQL in `database/` is the reproducible PRM2 schema. New public-schema objects use explicit Data API grants and row-level security.

For the CV lineage expansion, apply `database/cv_revisions.sql` after the existing
CV document, CV Block, and Composition schema. Apply
`database/cv_editing_sessions.sql` next to add durable Working Compositions and
atomic start, save, and finish boundaries. Apply
`database/cv_change_proposals.sql` after Editing Sessions to add immutable,
owner-scoped Change Proposals with atomic explicit apply and discard operations,
then `database/cv_lifecycle.sql` to add copy and archive/restore proposal
operations. Apply `database/cv_block_identity_lifecycle.sql` after those
composition tables exist to add versioned CV Block content validation,
owner/identity triggers, independent duplication, and archive/restore/delete
boundaries. Apply `database/cv_revision_publication.sql` to replace legacy
publication writes with reviewed exact-Revision publish, rollback, and
withdrawal proposals. Apply `database/cv_revision_export.sql` to expose the
owner-scoped immutable Revision snapshot used by composition adapters. Apply
`database/cv_legacy_contraction.sql` after migrated Revisions, Editing Sessions,
and Change Proposals have been verified; it creates new CVs directly with an
initial Editing Session and removes authenticated access to the legacy mutable
document/Composition writes. Apply
`database/cv_public_read.sql`. The Revision migration is transactional and
idempotent: it rejects duplicate CV Block identities before backfilling immutable
v1 snapshots and pinning existing public slugs to those snapshots. Finishing an
Editing Session allocates its Revision number under a CV-lineage lock and never
changes the Published Revision.

Working Composition edits can be represented as a versioned Change Proposal.
Creating or discarding a proposal does not alter its target Editing Session;
apply revalidates the proposal's expiry and base optimistic version, then changes
the Working Composition atomically. Repeated apply returns the original result,
while stale proposals return refreshed target context for recovery. The Nuxt UI
and future MCP handlers use the same CV workspace application-service methods.

“Copy to New Version” creates another open Editing Session in the same CV.
“Copy for New Role” creates an independent CV and open Editing Session whose
first finished Revision is v1. Both copy from an exact CV Revision or current
Editing Session snapshot without changing the source. CVs and Editing Sessions
are archived and restored through the same reviewed Change Proposal boundary;
their compositions remain retained, and CV archival never cascades to CV Blocks.

Publication always targets an exact immutable CV Revision through a reviewed
Change Proposal. Applying another Revision repoints the existing stable slug;
selecting an older Revision is an explicit rollback. Withdrawal immediately
deactivates access while retaining the CV, slug, pin, and Revision history.
Finishing an Editing Session never changes the published Revision.

Any immutable CV Revision can be exported through composition adapter
`json-resume` version `1`. Adapter identity and version stay in the Resume
Studio response envelope; the nested JSON Resume payload contains only standard
fields. Employment Occasions become ordered `work` entries, selected Experience
Blocks become ordered `highlights`, and ongoing roles omit `endDate`. Exported
dates accept `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` precision.

CV Block content is stored with schema version `1` and validated by the same
kind registry in the application and database for experience, skill,
certification, education, and interest content. Content changes append an
immutable Block Version with same-identity base provenance. Duplicating starts
an independent CV Block at v1. Referenced identities cannot be deleted and
return archive as the safe recovery action; archived CV Blocks remain available
for deliberate restoration.

CV lineage rows now retain identity, lifecycle, stable slug, and publication
state only. New profile, summary, theme, and selected Block Version content is
created in an Editing Session, and supported edits change its Working
Composition through the shared CV workspace service. The historical
`cv_compositions` table and `save_cv_document` migration remain only so existing
installations can be migrated and verified before the contraction migration
revokes their write surface.

OpenRouter requests run through the Nuxt server at `/api/openrouter`. The private
service-role key is used only server-side to call the restricted Vault RPCs in
`database/cv_ai_settings.sql`; provider keys are never placed in Nuxt public
runtime config or returned to the browser.

## Access model

The owner workspace uses Supabase passwordless email magic links with account creation disabled. `/app/**` routes require a session, and PRM2 RLS enforces ownership for documents, compositions, blocks, versions, contexts, and generation records.

Shared CVs use an **unlisted public** model: a visitor who knows `/cv/:slug` can read a CV only while its lineage is marked `published`. Unpublishing immediately withdraws anonymous access without deleting the draft. Existing public slugs are pinned to an explicit immutable CV Revision; public queries expose only that Revision's exact CV Composition and Block Versions.

### MCP OAuth

The Nuxt 4 server exposes Resume Studio's MCP transport at `/mcp`. Supabase Auth
is the OAuth 2.1 authorization server: it owns authorization-code + PKCE, refresh
tokens, and dynamic client registration. Resume Studio supplies the consent UI at
`/oauth/consent` and proxies Supabase's authorization-server and OpenID discovery
metadata from its own well-known routes. The protected-resource document is
available at `/.well-known/oauth-protected-resource` and the `/mcp`-specific form.

Before deploying, enable the OAuth server and dynamic client registration in the
Supabase dashboard, set the authorization path to `/oauth/consent`, and configure
the production Site URL and allowed redirect URLs. Disable new-user signups so
the project's account list remains the authorization allow-list. Use asymmetric JWT signing so
clients can consume OpenID discovery. Account creation remains disabled in the
application's magic-link flow, so consent is available only to existing
allow-listed accounts.

Every MCP request must carry the Supabase user access token issued to the OAuth
client. The server validates it with Supabase Auth, requires its OAuth `client_id`,
then builds the database client with that same bearer token. MCP tools therefore
run as the user under existing RLS policies; no privileged database credential is
used for MCP access. OAuth scopes describe the connection but do not replace RLS.

Authenticated MCP clients can discover read-only tools for CV lineages, CV
Revisions, Editing Sessions and Working Compositions, CV Blocks and Block
Versions, publication state, supported schemas, and JSON Resume export. These
reads return `{ schemaVersion: "1", data: ... }` envelopes and do not require a
Change Proposal or confirmation. They run through the same application services
as the Nuxt UI and stay scoped to the authenticated user's RLS-visible rows.

The MCP resource catalog publishes versioned product contracts at
`resume-studio://schemas/block-content/v1`,
`resume-studio://schemas/composition/v1`,
`resume-studio://schemas/change-proposal/v1`, and
`resume-studio://adapters`. These resources describe validation and workflow
rules only; they never contain account or CV data.

Published CV snapshots are generated before the Nuxt build and packaged as
server assets. Nuxt verifies the slug through the curated public Supabase contract
on every request before returning the snapshot, so withdrawal and verification
failures cannot leak a stale generated page.

## Themes and printing

Themes are registered in `src/domain/themes/themeRegistry.js`. `editorial` is the documented default for missing, unknown, or retired IDs; `modern` is the second supported theme. The same `CvDocument` renderer is used for workspace previews and public links. Both themes include A4 print rules, suppress application chrome, avoid preventable entry breaks, and preserve visible contact links.
