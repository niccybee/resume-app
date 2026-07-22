---
status: superseded by ADR-0008
---

# Persist CV Revisions throughout editing sessions

Starting an Editing Session immediately creates a durable draft CV Revision from a selected base Revision. Each explicitly applied Change Proposal atomically appends any required Block Versions and updates that same Revision, while finishing the session marks the Revision as current. This permits interruption, recovery, and incremental acceptance at the cost of retaining incomplete drafts instead of committing the entire session only at the end.
