# Resume Studio domain contract

Use these terms exactly.

## CV lifecycle

- **CV**: a stable role-and-employer-focused lineage containing a linear sequence of numbered CV Revisions.
- **CV Revision**: a numbered immutable snapshot created by finishing an Editing Session.
- **Published Revision**: the exact immutable Revision exposed by the CV's public link. It is selected explicitly and may be rolled back.
- **Editing Session**: a durable mutable workspace based on a CV Revision or copied session state.
- **Working Composition**: the mutable selection and ordering of exact Block Versions inside an Editing Session.
- **CV Composition**: the immutable ordered selection captured in a CV Revision.

Do not call a CV a resume. Do not call an Editing Session a chat, temporary draft, or draft CV Revision.

## Reusable content

- **CV Block**: a reusable content identity shared across CVs.
- **Block Version**: an immutable content snapshot appended to a CV Block.
- **Experience Block**: one professional achievement associated with an Employment Occasion.
- **Employment Occasion**: one period in which the user held a role at an employer.

A CV Composition may contain at most one Block Version from each CV Block identity. Duplicate the CV Block when two independently selectable entries are required.

## Control boundaries

- **Change Proposal**: a validated non-persistent intended change. It has no effect until explicitly applied.
- **Archived**: retained outside the active workspace for restoration or reuse.
- **Copy for New Role**: create an Editing Session for a new CV lineage whose first finished Revision will be Revision 1.
- **Copy to New Version**: create another Editing Session in the same CV.

Block Versions and CV Revisions never change in place. Archiving a CV does not archive its CV Blocks. Finishing an Editing Session does not publish the resulting Revision.
