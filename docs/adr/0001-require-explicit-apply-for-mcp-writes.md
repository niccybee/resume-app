# Require explicit apply for MCP writes

External chat clients provide inconsistent confirmation experiences, so MCP write requests create validated Change Proposals without persisting data. A separate explicit apply operation commits a proposal; reads remain immediate. This adds a round trip but gives users consistent control without trusting each chat client's tool-call interface to prevent unintended writes.
