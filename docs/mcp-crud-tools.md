# MCP CV and CV Block CRUD

Resume Studio exposes immediate reads and reviewed write proposals. A proposal
never mutates its target. The user must review the returned diff and explicitly
call `apply_change_proposal`; `discard_change_proposal` leaves the target
unchanged.

## CV tools

| Intent | MCP tool | Result |
| --- | --- | --- |
| Create | `propose_create_cv` | A pending proposal for a new CV and its first open Editing Session |
| Read | `list_cvs`, `get_cv` | CV lineage and publication metadata |
| Read work | `list_editing_sessions`, `get_editing_session` | Current Working Composition and optimistic version |
| Update | `propose_update_cv` | A pending full-state replacement for one open Editing Session |
| Delete semantics | `propose_archive_cv` | Retains the CV and its immutable Revisions outside the active workspace |
| Restore | `propose_restore_cv` | Returns an archived CV to the active workspace |

CVs are retained rather than permanently deleted. Archiving a CV does not
archive or delete its shared CV Blocks.

`propose_update_cv` requires the complete intended Working Composition and the
Editing Session's current optimistic version. Clients should call
`get_editing_session`, preserve fields they are not changing, then propose the
replacement.

## CV Block tools

| Intent | MCP tool | Result |
| --- | --- | --- |
| Create | `propose_create_cv_block` | A pending proposal for a CV Block identity and Block Version 1 |
| Read | `list_cv_blocks`, `get_cv_block`, `get_block_version` | CV Block metadata and immutable Block Versions |
| Update | `propose_update_cv_block` | A pending immutable Block Version append within one Editing Session |
| Duplicate | `propose_duplicate_cv_block` | A separately selectable CV Block identity |
| Archive | `propose_archive_cv_block` | Retains an eligible unreferenced CV Block and all Versions |
| Restore | `propose_restore_cv_block` | Returns an archived CV Block to the active library |
| Delete | `propose_delete_cv_block` | Permanently deletes only a CV Block that no CV Composition references |

Changing CV Block content never edits an existing Block Version. The proposal
must name the exact current `basedOnVersionId`; apply fails closed if a newer
Version has appeared.

## Apply sequence

1. Call the relevant read tool and capture exact identities and optimistic
   versions.
2. Call one `propose_*` tool.
3. Show the returned diff and warnings to the user.
4. Call `apply_change_proposal` only after the user confirms that exact proposal
   ID.
5. Re-read the affected CV, Editing Session, or CV Block.

The lower-level `propose_content_changes` and `propose_lifecycle_change` tools
remain available for advanced multi-operation workflows.
