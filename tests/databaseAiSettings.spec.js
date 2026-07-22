import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("Nuxt OpenRouter Vault boundary", () => {
  it("allows only the server service role to call Vault RPCs", async () => {
    const schema = await readFile(
      new URL("database/cv_ai_settings.sql", root),
      "utf8",
    );

    for (const signature of [
      "cv_ai_status(uuid)",
      "cv_ai_save(uuid, text, text)",
      "cv_ai_delete(uuid)",
      "cv_ai_credentials(uuid)",
    ]) {
      expect(schema).toContain(`revoke all on function public.${signature} from public, anon, authenticated`);
      expect(schema).toContain(`grant execute on function public.${signature} to service_role`);
    }
    expect(schema).toContain("vault.decrypted_secrets");
  });

  it("keeps the decrypted credential out of the status contract", async () => {
    const schema = await readFile(
      new URL("database/cv_ai_settings.sql", root),
      "utf8",
    );
    const statusStart = schema.indexOf("function public.cv_ai_status");
    const saveStart = schema.indexOf("function public.cv_ai_save");
    const statusContract = schema.slice(statusStart, saveStart);

    expect(statusContract).not.toContain("decrypted_secret");
    expect(statusContract).not.toContain("vault_secret_id");
  });
});
