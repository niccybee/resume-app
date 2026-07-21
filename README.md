# Resume Studio

A Nuxt 4 workspace for maintaining versioned CV content, composing role-specific drafts, privately previewing them, and publishing unlisted public CV links from PRM2 Supabase.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add PRM2's publishable key. Never use a Supabase secret or service-role key in the browser.
3. Install with `ni`, start with `nr dev`, test with `nr test`, and build with `nr build`.

`nr test` provisions the pinned Playwright Chromium build before running the browser suite, so clean machines and CI use the same browser version.

The checked-in SQL in `database/` is the reproducible PRM2 schema. New public-schema objects use explicit Data API grants and row-level security.

OpenRouter requests run through the Nuxt server at `/api/openrouter`. The private
service-role key is used only server-side to call the restricted Vault RPCs in
`database/cv_ai_settings.sql`; provider keys are never placed in Nuxt public
runtime config or returned to the browser.

## Access model

The owner workspace uses Supabase passwordless email magic links with account creation disabled. `/app/**` routes require a session, and PRM2 RLS enforces ownership for documents, compositions, blocks, versions, contexts, and generation records.

Shared CVs use an **unlisted public** model: a visitor who knows `/cv/:slug` can read a CV only while its document is marked `published`. Unpublishing immediately withdraws anonymous access without deleting the draft. Public queries can read only the document, composition rows, and exact immutable block versions referenced by that published document.

## Themes and printing

Themes are registered in `src/domain/themes/themeRegistry.js`. `editorial` is the documented default for missing, unknown, or retired IDs; `modern` is the second supported theme. The same `CvDocument` renderer is used for workspace previews and public links. Both themes include A4 print rules, suppress application chrome, avoid preventable entry breaks, and preserve visible contact links.
