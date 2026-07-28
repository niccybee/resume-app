import { isDeveloperAccessEnabled } from "../auth/developerAccess";
import { supabase } from "../supabase";
import { createModeAwareService } from "./createModeAwareService";

const METADATA_KEY = "resume_studio_profile";
const DEVELOPMENT_STORAGE_KEY = "resume-studio:profile-defaults";
const DEVELOPMENT_FALLBACK = {
  name: "Alex Morgan",
  email: "alex@example.com",
};

function normalizeDefaults(value = {}) {
  return {
    name: typeof value.name === "string" ? value.name.trim() : "",
    email: typeof value.email === "string" ? value.email.trim() : "",
  };
}

export function createSupabaseCvProfileDefaults({ client }) {
  return {
    async load() {
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      const user = data?.user;
      if (!user) return normalizeDefaults();
      const stored = normalizeDefaults(user.user_metadata?.[METADATA_KEY]);
      return {
        name: stored.name || user.user_metadata?.full_name || user.user_metadata?.name || "",
        email: stored.email || user.email || "",
      };
    },
    async save(value) {
      const defaults = normalizeDefaults(value);
      const { error } = await client.auth.updateUser({
        data: { [METADATA_KEY]: defaults },
      });
      if (error) throw error;
      return { ...defaults, scope: "account" };
    },
  };
}

export function createDevelopmentCvProfileDefaults({
  storage = typeof window === "undefined" ? null : window.localStorage,
} = {}) {
  return {
    async load() {
      if (!storage) return DEVELOPMENT_FALLBACK;
      try {
        return normalizeDefaults(
          JSON.parse(storage.getItem(DEVELOPMENT_STORAGE_KEY) || "null")
            || DEVELOPMENT_FALLBACK,
        );
      } catch {
        return DEVELOPMENT_FALLBACK;
      }
    },
    async save(value) {
      const defaults = normalizeDefaults(value);
      storage?.setItem(DEVELOPMENT_STORAGE_KEY, JSON.stringify(defaults));
      return { ...defaults, scope: "developer" };
    },
  };
}

export const cvProfileDefaults = createModeAwareService({
  primary: createSupabaseCvProfileDefaults({ client: supabase }),
  developer: createDevelopmentCvProfileDefaults(),
  developerAccessEnabled: isDeveloperAccessEnabled,
});
