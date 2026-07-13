// @vitest-environment jsdom

import { createPinia } from "pinia";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory } from "vue-router";
import { beforeEach, expect, it, vi } from "vitest";
import App from "../App.vue";
import { supabase } from "../supabase";
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
  supabase.from.mockImplementation(() => ({
    select: vi.fn().mockResolvedValue({ data: [], error: null }),
  }));
});

async function mountWorkspace(path) {
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

it("opens the workspace at the saved CV screen", async () => {
  const { router, wrapper } = await mountWorkspace("/app");

  expect(router.currentRoute.value.path).toBe("/app/cvs");
  expect(wrapper.get('[data-layout="workspace"]').text()).toContain("Saved CVs");
  expect(wrapper.find('[data-layout="public-site"]').exists()).toBe(false);
});

it("navigates between saved CVs, blocks, and the builder", async () => {
  const { router, wrapper } = await mountWorkspace("/app/cvs");

  await wrapper.get('[data-nav="blocks"]').trigger("click");
  await flushPromises();
  expect(router.currentRoute.value.path).toBe("/app/blocks");
  expect(wrapper.get("h1").text()).toBe("Reusable blocks");

  await wrapper.get('[data-nav="builder"]').trigger("click");
  await flushPromises();
  expect(router.currentRoute.value.path).toBe("/app/builder");
  expect(wrapper.get("h1").text()).toBe("CV builder");
});

it.each([
  ["/cv", "/app/cvs"],
  ["/build", "/app/builder"],
])("redirects the legacy %s route to %s", async (legacyPath, workspacePath) => {
  const { router } = await mountWorkspace(legacyPath);

  expect(router.currentRoute.value.path).toBe(workspacePath);
});

it("keeps unknown workspace URLs inside the workspace shell", async () => {
  const { router, wrapper } = await mountWorkspace("/app/missing");

  expect(router.currentRoute.value.name).toBe("Workspace Not Found");
  expect(wrapper.get('[data-layout="workspace"]').text()).toContain(
    "The requested workspace page does not exist",
  );
  expect(wrapper.find('[data-layout="public-site"]').exists()).toBe(false);
});

it("shows unavailable data sources without an unhandled route failure", async () => {
  supabase.from.mockImplementation((table) => ({
    select: vi.fn().mockResolvedValue({
      data: null,
      error: { message: `${table} is not available in PRM2` },
    }),
  }));

  const { router, wrapper } = await mountWorkspace("/app/cvs");
  await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toContain(
    "Saved CVs are unavailable",
  );

  await router.push("/app/blocks");
  await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toContain(
    "Reusable blocks are unavailable",
  );
});
