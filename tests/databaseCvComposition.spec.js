import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

describe("CV Composition database invariant", () => {
  it("enforces one Block Version per CV Block in fresh and migrated schemas", async () => {
    const [schema, migration] = await Promise.all([
      readFile(new URL("database/cv_documents.sql", root), "utf8"),
      readFile(new URL("database/cv_composition_block_identity.sql", root), "utf8"),
    ]);

    expect(schema).toMatch(/unique\s*\(cv_id,\s*block_id\)/i);
    expect(migration).toMatch(/having\s+count\(\*\)\s*>\s*1/i);
    expect(migration).toMatch(/unique\s*\(cv_id,\s*block_id\)/i);
    expect(migration).toContain("duplicate the CV Block");
  });

  it("rejects duplicate CV Block selections before the atomic save mutates data", async () => {
    const atomicSave = await readFile(
      new URL("database/cv_atomic_save.sql", root),
      "utf8",
    );

    const validation = atomicSave.indexOf(
      "A CV can include at most one Block Version from each CV Block.",
    );
    const mutation = atomicSave.indexOf("delete from public.cv_compositions");

    expect(validation).toBeGreaterThan(-1);
    expect(mutation).toBeGreaterThan(validation);
  });
});
