---
name: resume-studio
description: Use the authenticated Resume Studio MCP to inspect, create, tailor, version, archive, restore, export, and safely delete CVs and reusable CV Blocks. Use when the user asks to work on their CV, professional-history library, Block Versions, Editing Sessions, CV Revisions, role-focused applications, or Resume Studio connection.
---

# Resume Studio

Use Resume Studio as the source of truth for the user's CVs and reusable professional-history content. Keep every write reviewable: propose first, show the exact Change Proposal, and apply only after a separate explicit confirmation.

## Start safely

1. Confirm that the Resume Studio MCP tools are available. If they are missing, stop and help the user connect `https://cv.obair.tech/mcp`; do not imitate tool results.
2. Use `who_am_i` when identity or connection status is unclear.
3. Read the relevant CV, CV Block, CV Revision, or Editing Session before suggesting a change.
4. Call `get_supported_schemas` before constructing unfamiliar content or composition payloads. Treat its result and the live tool input schema as authoritative.
5. Resolve ambiguous names into exact IDs with list tools. Ask the user to choose when multiple plausible targets remain.

Read [references/domain-contract.md](references/domain-contract.md) before changing a CV, CV Block, Block Version, Editing Session, or CV Revision.

## Choose the workflow

### Read or compare

Call the narrowest read tool and answer from returned data. Use exact domain terms and distinguish:

- current Working Composition from immutable CV Revisions;
- the latest Revision from the explicitly Published Revision;
- a CV Block identity from one immutable Block Version.

### Create or change

1. Read the target and capture its current optimistic version or `basedOnVersionId`.
2. Preserve every field the user did not ask to change.
3. Call the narrowest matching `propose_*` tool.
4. Present the proposal using the format in [references/response-frameworks.md](references/response-frameworks.md).
5. Stop and wait for the user to explicitly approve that proposal.
6. After approval, call `apply_change_proposal` with the exact proposal ID.
7. Re-read the affected object and report what is now saved.

Never create and apply a proposal in one uninterrupted step. A request such as "make this better" authorizes drafting a proposal, not applying it. A later response such as "apply proposal `<id>`" authorizes the apply call.

### Discard

Call `discard_change_proposal` only when the user explicitly rejects or asks to discard a known pending proposal. Confirm that no target data changed.

## Preserve the model

- Change CV content inside an open Editing Session. Applied changes update its Working Composition; finishing it creates a new immutable CV Revision.
- Append a Block Version when content changes. Never describe an existing Block Version as edited.
- Keep at most one Block Version from a given CV Block in a CV Composition. Duplicate the CV Block when the user needs a second independently selectable entry.
- Archive CVs by default instead of deleting them. Archiving a CV never cascades to shared CV Blocks.
- Permanently delete a CV Block only through `propose_delete_cv_block`, and only when Resume Studio reports that no CV Composition references any of its Block Versions.
- Use **Copy for New Role** for a new CV lineage and **Copy to New Version** for another Editing Session in the same CV. Keep the source open and unchanged.
- Do not publish a Revision merely because an Editing Session finished. Publication is a separate explicit choice.

## Draft trustworthy content

- Do not invent employers, roles, dates, qualifications, metrics, tools, or outcomes.
- Ask for missing facts when they materially affect the claim.
- Keep one Experience Block focused on one achievement and associate it with its Employment Occasion.
- Prefer concrete evidence and the user's terminology over generic CV language.
- Keep schema-shaped content separate from explanatory prose. Pass only validated structured data to MCP tools.

Read [references/tool-map.md](references/tool-map.md) for operation selection and required read-before-write sequences.

## Handle failures

- On an optimistic-version or stale-target conflict, re-read the target, explain what changed, and prepare a fresh proposal. Never retry an old proposal blindly.
- On authentication failure, ask the user to reconnect the Resume Studio MCP with the same account that owns the CVs.
- On disabled MCP access, ask the user to enable MCP in Resume Studio settings.
- On schema validation failure, retrieve supported schemas, repair only the invalid fields, and present the corrected proposal.
- When a tool is unavailable, say which capability is missing. Do not claim a write or read occurred.

## Client setup

If the skill is installed but Resume Studio is not connected, read [references/client-setup.md](references/client-setup.md) and give instructions only for the user's current client.
