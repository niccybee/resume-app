import { createBlockLibrary } from "../domain/blocks/blockLibrary";
import { createSupabaseBlockRepository } from "../infrastructure/blocks/createSupabaseBlockRepository";
import { supabase } from "../supabase";

export const blockLibrary = createBlockLibrary({
  repository: createSupabaseBlockRepository({ client: supabase }),
});
