// @vitest-environment jsdom

import { createPinia } from "pinia";
import { mount } from "@vue/test-utils";
import { createMemoryHistory } from "vue-router";
import { beforeEach, expect, it, vi } from "vitest";
import App from "../App.vue";
import { createAppRouter } from "./index";

vi.mock("../services/cvWorkspace", () => ({
  cvWorkspace: { getPublic: vi.fn().mockResolvedValue(null) },
}));
vi.mock("../supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(),
      signInWithOtp: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function mountPublicSite(path) {
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();

  const wrapper = mount(App, {
    global: {
      plugins: [createPinia(), router],
    },
  });

  return { router, wrapper };
}

it("renders the public resume without workspace navigation", async () => {
  const { wrapper } = await mountPublicSite("/");

  expect(wrapper.get('[data-layout="public-site"]').text()).toContain(
    "Write once",
  );
  expect(wrapper.find("[data-workspace-navigation]").exists()).toBe(false);
});

it("keeps a shared CV slug inside the public site shell", async () => {
  const { router, wrapper } = await mountPublicSite("/cv/example");

  expect(router.currentRoute.value.name).toBe("Public Resume");
  expect(wrapper.find("[data-workspace-navigation]").exists()).toBe(false);
});

it("renders unknown public URLs inside the public shell", async () => {
  const { wrapper } = await mountPublicSite("/missing");

  expect(wrapper.get('[data-layout="public-site"]').text()).toContain(
    "Unable to find that CV",
  );
});
