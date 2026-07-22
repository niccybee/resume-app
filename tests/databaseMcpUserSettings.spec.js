import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migration = await readFile(
  new URL("../supabase/migrations/20260722112756_enable_user_mcp_settings.sql", import.meta.url),
  "utf8",
);

describe("MCP user settings migration", () => {
  it("keeps each authenticated owner scoped to one opt-in row", () => {
    expect(migration).toMatch(/owner_id uuid primary key references auth\.users\(id\) on delete cascade/);
    expect(migration).toMatch(/alter table public\.cv_mcp_user_settings enable row level security/);
    expect(migration.match(/\(select auth\.uid\(\)\) = owner_id/g)).toHaveLength(4);
  });

  it("exposes only the minimum Data API operations", () => {
    expect(migration).toMatch(/revoke all on public\.cv_mcp_user_settings from public, anon, authenticated/);
    expect(migration).toMatch(/grant select, insert, update on public\.cv_mcp_user_settings to authenticated/);
    expect(migration).not.toMatch(/grant delete .* authenticated/);
  });
});
