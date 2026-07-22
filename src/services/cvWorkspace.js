import { createCvWorkspace } from "../domain/cvs/createCvWorkspace";
import { createSupabaseCvRepository } from "../infrastructure/cvs/createSupabaseCvRepository";
import { developerWorkspace } from "../development/createDeveloperWorkspace";
import { isDeveloperAccessEnabled } from "../auth/developerAccess";
import { createModeAwareService } from "./createModeAwareService";
import { openRouter } from "./openRouter";
import { blockLibrary } from "./blockLibrary";
import { supabase } from "../supabase";

const openRouterSummaryAdapter = {
  name: "openrouter",
  suggest: (input) => openRouter.suggestSummary(input),
};

const supabaseCvWorkspace = createCvWorkspace({
  repository: createSupabaseCvRepository({ client: supabase }),
  blockLibrary,
  summaryGenerator: openRouterSummaryAdapter,
});

export const cvWorkspace = createModeAwareService({
  primary: supabaseCvWorkspace,
  developer: developerWorkspace.cvWorkspace,
  developerAccessEnabled: isDeveloperAccessEnabled,
});
