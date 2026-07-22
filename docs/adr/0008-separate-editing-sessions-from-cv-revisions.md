# Separate Editing Sessions from CV Revisions

Editing Sessions are durable, mutable workspaces, while CV Revisions are immutable snapshots created only when a session finishes. A CV may have multiple open sessions based on any earlier Revision or copied session state; applying a Change Proposal changes only the target session's Working Composition. This supports resumable parallel exploration and editing from historical Revisions, at the cost of explicit session targeting, more lifecycle state, and conflict handling when sessions finish concurrently. This supersedes ADR-0005 and ADR-0006.
