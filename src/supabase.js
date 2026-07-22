import { createClient } from "@supabase/supabase-js";

export let isSupabaseConfigured = false;

let configuredUrl = "";
let configuredPublishableKey = "";
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
