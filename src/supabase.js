import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export let isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);

let configuredUrl = supabaseUrl;
let configuredPublishableKey = supabasePublishableKey;
let activeClient;

function getActiveClient() {
  activeClient ||= createClient(
    configuredUrl || "https://placeholder.supabase.co",
    configuredPublishableKey || "placeholder-publishable-key",
  );
  return activeClient;
}

export const supabase = new Proxy({}, {
  get(_target, property) {
    const client = getActiveClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export function configureSupabase({ url, publishableKey }) {
  if (url === configuredUrl && publishableKey === configuredPublishableKey) return;

  activeClient?.auth?.stopAutoRefresh?.();
  activeClient = undefined;
  configuredUrl = url;
  configuredPublishableKey = publishableKey;
  isSupabaseConfigured = Boolean(url && publishableKey);
}
