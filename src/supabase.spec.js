import { beforeEach, expect, it, vi } from "vitest";

const createClient = vi.fn((url, key) => ({ url, key }));

vi.mock("@supabase/supabase-js", () => ({ createClient }));

const supabaseModule = await import("./supabase");

beforeEach(() => {
  createClient.mockClear();
});

it("reconfigures the stable compatibility client from Nuxt public runtime config", () => {
  const originalClient = supabaseModule.supabase;

  supabaseModule.configureSupabase({
    url: "https://runtime.example.supabase.co",
    publishableKey: "runtime-publishable-key",
  });
  supabaseModule.configureSupabase({
    url: "https://runtime.example.supabase.co",
    publishableKey: "runtime-publishable-key",
  });

  expect(supabaseModule.supabase).toBe(originalClient);
  expect(supabaseModule.supabase.url).toBe("https://runtime.example.supabase.co");
  expect(supabaseModule.supabase.key).toBe("runtime-publishable-key");
  expect(supabaseModule.isSupabaseConfigured).toBe(true);
  expect(createClient).toHaveBeenCalledTimes(1);
});
