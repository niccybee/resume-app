# Resume Studio

Resume Studio manages reusable professional-history content and composes it into role-focused CVs.

## Language

**CV**:
A stable, role-and-employer-focused lineage that groups a linear sequence of numbered CV Revisions.
_Avoid_: Resume

**CV Revision**:
A numbered, immutable snapshot of a CV created by finishing an Editing Session. Its number records completion order, while its base Revision records ancestry; it may be used as the base for later work but is never modified.
_Avoid_: CV copy, standalone version

**Published Revision**:
The immutable CV Revision currently exposed through a CV's public link. Finishing an Editing Session never changes it; publication must explicitly select a Revision and may later select an older Revision for rollback.
_Avoid_: Live draft, latest Revision

**CV Block**:
A reusable unit of CV content whose identity persists across revisions and is not owned by any single CV. It may be deleted only when no CV Composition references any of its Block Versions; otherwise it may only be archived.
_Avoid_: Resume block, item

**Block Version**:
An immutable snapshot of a CV Block's content. Changing content appends a new Block Version rather than modifying an existing one.
_Avoid_: Edited block

**Experience Block**:
A CV Block containing one professional achievement associated with an Employment Occasion. It becomes one highlight when exported as a JSON Resume work entry.
_Avoid_: Job, work entry

**Employment Occasion**:
One period in which the user held a role at an employer. It groups Experience Blocks and supplies the employer, position, dates, and related details of a JSON Resume work entry.
_Avoid_: Company, role

**CV Composition**:
The ordered selection of exact Block Versions included in a CV Revision. It may contain at most one Block Version from any given CV Block; a second independently selectable entry requires a separate CV Block. It is format-neutral and may be projected through schema-versioned adapters into JSON Resume or other document formats.
_Avoid_: Resume contents

**Working Composition**:
The mutable selection and ordering of Block Versions inside an Editing Session. Finishing the session snapshots it as the new CV Revision's CV Composition.
_Avoid_: Draft CV Revision

**Archived**:
A retained state outside the active workspace. Archived CVs, CV Blocks, and Editing Sessions are kept for deliberate restoration or reuse rather than deleted. Archiving an Editing Session preserves its Working Composition without creating or changing a CV Revision. Archiving a CV never cascades to its CV Blocks; a CV Block becomes eligible for explicit archival only when no CV Composition belonging to a non-archived CV references any of its Block Versions.
_Avoid_: Deleted, inactive

**Change Proposal**:
A validated, non-persistent description of an intended change to an Editing Session, CV, CV Block, or publication. It has no effect until the user explicitly applies it.
_Avoid_: Pending change, draft write

**Import Proposal**:
A staged set of CV Blocks derived from an external source. The user may review, edit, deduplicate, and selectively accept its entries before any CV Blocks or Block Versions are created.
_Avoid_: Automatic import, imported draft

**LinkedIn Identity**:
A LinkedIn account linked to a Resume Studio user as an authentication method. It identifies the user but does not represent access to their professional-history data.
_Avoid_: LinkedIn integration, LinkedIn data connection

**Editing Session**:
A durable, mutable workspace based on a selected CV Revision or copied session state. Applied Change Proposals persist into its Working Composition; finishing the session creates a new immutable CV Revision. A CV may have multiple open Editing Sessions.
_Avoid_: Chat, temporary draft, draft CV Revision

**CV Copy**:
A clone of a source CV Revision or Editing Session state with an explicit lineage intent. **Copy for New Role** opens an Editing Session for a new CV whose first finished Revision will be Revision 1; **Copy to New Version** opens another Editing Session in the same CV. The source remains unchanged and, when it is an Editing Session, remains open.
_Avoid_: Branch, fork, generic duplicate
