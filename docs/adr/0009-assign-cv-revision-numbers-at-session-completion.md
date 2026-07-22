# Assign CV Revision numbers at session completion

A CV Revision receives the next available number atomically when its Editing Session finishes. The Revision separately records the base Revision from which the session began, so numbering represents completion order rather than ancestry. This avoids gaps and reservations for abandoned sessions, while accepting that a later number may descend from an older Revision and must display that ancestry explicitly.
