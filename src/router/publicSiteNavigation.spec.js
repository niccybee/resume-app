// @vitest-environment jsdom

import { createPinia } from "pinia";
import { mount } from "@vue/test-utils";
import { createMemoryHistory } from "vue-router";
import { beforeEach, expect, it, vi } from "vitest";
import App from "../App.vue";
import { createAppRouter } from "./index";

vi.mock("../supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
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
    "Past Experience",
  );
  expect(wrapper.find("[data-workspace-navigation]").exists()).toBe(false);
});

it("keeps a shared CV slug inside the public site shell", async () => {
  const { router, wrapper } = await mountPublicSite("/cv/example");

  expect(router.currentRoute.value.name).toBe("Public Resume");
  expect(wrapper.get('[data-layout="public-site"]').text()).toContain(
    "route: example",
  );
  expect(wrapper.find("[data-workspace-navigation]").exists()).toBe(false);
});

it("renders unknown public URLs inside the public shell", async () => {
  const { wrapper } = await mountPublicSite("/missing");

  expect(wrapper.get('[data-layout="public-site"]').text()).toContain(
    "Unable to find that CV",
  );
});
