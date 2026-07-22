import { createBlockLibrary } from "../domain/blocks/blockLibrary";
import { createSupabaseBlockRepository } from "../infrastructure/blocks/createSupabaseBlockRepository";
import { developerWorkspace } from "../development/createDeveloperWorkspace";
import { isDeveloperAccessEnabled } from "../auth/developerAccess";
import { createModeAwareService } from "./createModeAwareService";
import { supabase } from "../supabase";

const supabaseBlockLibrary = createBlockLibrary({
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

export const blockLibrary = createModeAwareService({
  primary: supabaseBlockLibrary,
  developer: developerWorkspace.blockLibrary,
  developerAccessEnabled: isDeveloperAccessEnabled,
});
