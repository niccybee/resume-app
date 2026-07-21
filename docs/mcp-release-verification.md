# MCP release verification

Resume Studio MCP is released only with a non-empty server-side user allow-list,
the audit migration applied, and both automated and external-client checks green.

## Deployment controls

Set `NUXT_MCP_ALLOWED_USER_IDS` to a comma-separated list of Supabase user UUIDs.
Generate a separate random `NUXT_MCP_GATEWAY_KEY` of at least 32 characters,
store it only in the server environment, and upsert its lowercase SHA-256 digest
into the single row of `cv_mcp_gateway_config`. Never put the raw key in SQL,
repository files, client runtime configuration, or release logs. The PostgREST
pre-request hook allows normal browser JWTs through but rejects OAuth JWTs unless
they arrived through the Resume Studio MCP server with this key.
An empty list fails closed at `/mcp`. The defaults allow 120 authentication
attempts, 120 reads, and 60 mutations per actor/client per minute. Netlify's
Edge Function applies the shared pre-authentication IP/domain bucket; Supabase's
atomic `enforce_mcp_rate_limit` function owns the authenticated read/mutation
buckets and does not accept caller-selected limits or windows. Change those
policies only through reviewed deployment code and a database migration.

Apply `database/cv_mcp_release_hardening.sql` after the Change Proposal and MCP
lifecycle migrations, followed by `database/cv_mcp_advisor_hardening.sql`, then
configure the gateway-key digest before enabling MCP traffic. The follow-up
moves the PostgREST request hook to the unexposed `private` schema and adds
covering indexes for the new composite foreign keys. The audit table is not
readable by browser or MCP roles.
Its authenticated recorder derives the actor from `auth.uid()` and accepts only
bounded identity arrays, an OAuth client identifier, operation, result, optional
error code, and server time.
Successful proposal creation, apply, and discard events are inserted by a
database trigger in the same transaction as the mutation. Transport-level
failures and read outcomes use the restricted recorder.

After computing the digest outside the database, apply it without the raw key:

```sql
insert into public.cv_mcp_gateway_config(singleton, gateway_key_sha256)
values (true, '<64-character-lowercase-sha256>')
on conflict (singleton) do update
set gateway_key_sha256 = excluded.gateway_key_sha256,
    updated_at = now();
```

The ingress guard follows Supabase's
[Data API pre-request pattern](https://supabase.com/docs/guides/api/securing-your-api?pre-request=use-additional-api-key&queryGroups=pre-request).

## Automated release gate

Run:

```sh
nr typecheck
nr test
nr verify:database
nr build
```

The suite covers database contracts, malformed/expired/wrong-audience tokens,
allow-list denial, OAuth grant revocation, MCP protocol discovery, browser smoke,
secret scans, bounded enumeration, proposal redaction, audit redaction, explicit
apply, reconnect, and persisted readback.
`verify:database` starts a disposable local PostgreSQL cluster, applies the real
hardening migration, and proves browser access, OAuth gateway denial/pass,
transactional audit commit, and mutation rollback when its audit cannot commit.

## Live external-client verification

First connect an allow-listed existing account from the intended chat client and
confirm it discovers `resume-studio://glossary/v1`, `list_cvs`,
`propose_lifecycle_change`, and `apply_change_proposal`. Ask it to use **Copy to
New Version**, review the pending proposal, explicitly approve that exact
proposal, reconnect the client, and confirm the new Editing Session appears in
the same CV. The source must remain open.

The repeatable protocol check performs the same non-destructive operation using
the standards SDK. Supply a short-lived access token only through the process
environment; the script never prints it:

```sh
RESUME_STUDIO_MCP_URL=https://resume.example/mcp \
RESUME_STUDIO_MCP_ACCESS_TOKEN=... \
RESUME_STUDIO_MCP_CV_ID=... \
RESUME_STUDIO_MCP_SOURCE_SESSION_ID=... \
RESUME_STUDIO_MCP_BASE_OPTIMISTIC_VERSION=... \
RESUME_STUDIO_MCP_CONFIRM_APPLY=copy-to-new-version \
RESUME_STUDIO_MCP_OAUTH_CLIENT_ID=... \
RESUME_STUDIO_SUPABASE_PUBLISHABLE_KEY=... \
RESUME_STUDIO_MCP_CONFIRM_REVOKE=oauth-grant \
nr verify:mcp
```

The script revokes that OAuth client's grant after persisted readback and proves
the same token can no longer reconnect. This invalidates that client's active
sessions and refresh tokens, so reauthorization is required afterward. Retain
the audit identifiers and timestamps, not the token, CV text, prompt, or Change
Proposal operations, with the release record.
