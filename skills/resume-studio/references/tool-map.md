# Resume Studio MCP tool map

Prefer the narrow CRUD tools. Use the lower-level multi-operation tools only when the requested change genuinely spans several operations.

## Connection and contracts

| Need | Tool |
| --- | --- |
| Confirm authenticated identity | `who_am_i` |
| Read current schemas and adapters | `get_supported_schemas` |

## CVs and Editing Sessions

| Intent | Read first | Propose or act |
| --- | --- | --- |
| List CVs | — | `list_cvs` |
| Inspect a CV | `list_cvs` | `get_cv` |
| Create a CV | `list_cvs` | `propose_create_cv` |
| List work in progress | `get_cv` | `list_editing_sessions` |
| Inspect working content | `list_editing_sessions` | `get_editing_session` |
| Replace Working Composition | `get_editing_session` | `propose_update_cv` |
| Archive or restore CV | `get_cv` | `propose_archive_cv` / `propose_restore_cv` |
| Apply or reject a proposal | proposal result | `apply_change_proposal` / `discard_change_proposal` |

`propose_update_cv` is a full-state replacement. Preserve all unchanged profile, summary, theme, and selection fields and send the current optimistic version.

## CV Blocks

| Intent | Read first | Propose or act |
| --- | --- | --- |
| List CV Blocks | — | `list_cv_blocks` |
| Inspect identity and history | `list_cv_blocks` | `get_cv_block` |
| Inspect exact content | `get_cv_block` | `get_block_version` |
| Create | `get_supported_schemas` | `propose_create_cv_block` |
| Append changed content | `get_cv_block`, `get_editing_session` | `propose_update_cv_block` |
| Make independently selectable copy | `get_block_version` | `propose_duplicate_cv_block` |
| Archive or restore | `get_cv_block` | `propose_archive_cv_block` / `propose_restore_cv_block` |
| Permanently delete if unreferenced | `get_cv_block` | `propose_delete_cv_block` |

For an update, pass the exact current `basedOnVersionId`. The new Block Version is appended only when the reviewed proposal is applied.

## Revisions, publication, and export

| Intent | Tool |
| --- | --- |
| List immutable history | `list_cv_revisions` |
| Inspect exact Revision | `get_cv_revision` |
| Inspect public pointer | `get_publication_state` |
| Export through an adapter | `export_cv_revision` |

Use `propose_lifecycle_change` for supported lifecycle operations that do not yet have a narrow tool. Use `propose_content_changes` only for a deliberate reviewed multi-operation change.
