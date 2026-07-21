import { createCvWorkspace } from "../domain/cvs/createCvWorkspace";
import { createSupabaseCvRepository } from "../infrastructure/cvs/createSupabaseCvRepository";
import { openRouter } from "./openRouter";
import { blockLibrary } from "./blockLibrary";
import { supabase } from "../supabase";

const openRouterSummaryAdapter = {
  name: "openrouter",
  suggest: (input) => openRouter.suggestSummary(input),
};

export const cvWorkspace = createCvWorkspace({
  repository: createSupabaseCvRepository({ client: supabase }),
  blockLibrary,
  summaryGenerator: openRouterSummaryAdapter,
});
