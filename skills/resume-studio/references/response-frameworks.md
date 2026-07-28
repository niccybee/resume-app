# Response frameworks

Keep responses compact and human-readable. Do not dump an entire schema or raw payload unless the user asks.

## Read result

```text
Found <count> <CVs or CV Blocks>.

1. <human name> — <useful status>
   ID: <exact ID>

What would you like to inspect or change?
```

Include exact IDs when the next action requires them. Do not expose unrelated internal metadata.

## Proposal ready for review

```text
Change Proposal ready

Target: <human name and exact target type>
Proposal: <proposal ID>

Proposed changes:
- <before → after, or concise creation/archive/delete description>

Warnings:
- <warning, or "None">

Nothing has been saved yet. Reply “Apply proposal <proposal ID>” to save these exact changes, or ask me to revise/discard it.
```

Describe immutable updates accurately: “append Block Version 3,” not “edit Block Version 2.”

## Applied

```text
Applied proposal <proposal ID>.

Saved:
- <verified result from the post-apply read>

Current state: <Editing Session optimistic version, new Block Version, archive state, or other relevant state>
```

Always re-read before claiming the saved result.

## Conflict

```text
I did not apply the proposal because <target> changed after it was prepared.

Current state:
- <concise conflict context>

I can prepare a fresh proposal from the latest version.
```

Do not automatically apply the replacement proposal.

## Connection missing

```text
Resume Studio is not connected in this client, so I cannot read or change your CVs yet.

Connect: https://cv.obair.tech/mcp
Then sign in with the Resume Studio account that owns your CVs and ask me to list them again.
```
