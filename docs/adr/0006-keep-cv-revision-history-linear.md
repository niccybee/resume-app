---
status: superseded by ADR-0008
---

# Keep CV Revision history linear

Each CV has a strictly linear Revision history and at most one open Editing Session. Starting work while a session is already open resumes that session instead of creating a competing branch. Parallel directions require explicitly duplicating the CV into a separate lineage, accepting a deliberate duplication step in exchange for simple numbering, conflict handling, and a single unambiguous current Revision.
