import { createBlockLibrary } from "../domain/blocks/blockLibrary";
import { createSupabaseBlockRepository } from "../infrastructure/blocks/createSupabaseBlockRepository";
import { supabase } from "../supabase";

export const blockLibrary = createBlockLibrary({
  repository: createSupabaseBlockRepository({ client: supabase }),
  generator: {
    name: "reviewable-local-proposal",
    async suggest({ baseVersion, instruction }) {
      const content = structuredClone(baseVersion.content);
      const field = ["text", "name", "institution"].find(
        (candidate) => typeof content[candidate] === "string",
      );
      if (field) content[field] = `${content[field]} — ${instruction}`;
      return { content, generator: this.name };
    },
  },
});
