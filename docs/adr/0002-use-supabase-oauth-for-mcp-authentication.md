# Use Supabase OAuth for MCP authentication

Remote MCP clients authenticate through Supabase Auth's OAuth 2.1 authorization-code flow with PKCE and dynamic client registration. This is the only interactive MCP authentication path in the first version: it reuses existing user identities and row-level security while avoiding permanent personal access tokens. We accept depending on Supabase's beta OAuth server to provide standards-based discovery, consent, and broad MCP-client compatibility.
