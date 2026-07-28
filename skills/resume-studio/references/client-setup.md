# Client connection setup

The skill supplies workflow instructions. The Resume Studio MCP supplies authenticated data and actions. Both must be enabled.

Endpoint: `https://cv.obair.tech/mcp`

Before connecting a client, sign in to Resume Studio and enable MCP under Settings.

## ChatGPT

1. Install the skill ZIP from Plugins → Skills → Create → Upload.
2. Open Settings → Apps and create a custom app named **Resume Studio**.
3. Enter the endpoint, choose OAuth, scan tools, and complete sign-in.
4. Start a new chat with both the Resume Studio skill and app available.

Custom MCP write actions depend on the user's ChatGPT plan and workspace permissions.

## Codex

```bash
codex mcp add resume-studio --url https://cv.obair.tech/mcp
codex mcp login resume-studio
```

Restart or begin a new task if the running task does not discover the newly installed skill or MCP.

## OpenCode

Add a remote OAuth MCP server named `resume-studio` with the endpoint above, then run:

```bash
opencode mcp auth resume-studio
opencode mcp list
```

## Claude Code

```bash
claude mcp add --transport http --scope user resume-studio https://cv.obair.tech/mcp
claude mcp login resume-studio
```

For claude.ai, upload the same skill ZIP in Settings → Features and add Resume Studio as an MCP connection where the account supports custom connections.
