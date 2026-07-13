import { createCvWorkspace } from "../domain/cvs/createCvWorkspace";
import { createSupabaseCvRepository } from "../infrastructure/cvs/createSupabaseCvRepository";
import { supabase } from "../supabase";

const localSummaryAdapter = {
  name: "reviewable-local-proposal",
  async suggest({ draft, instruction }) {
    const role = draft.profile?.basics?.label || draft.name;
    return {
      text: `${role}. ${instruction}`.trim(),
      provider: this.name,
    };
  },
};

export const cvWorkspace = createCvWorkspace({
  repository: createSupabaseCvRepository({ client: supabase }),
  summaryGenerator: localSummaryAdapter,
});

