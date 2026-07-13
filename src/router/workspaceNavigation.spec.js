// @vitest-environment jsdom

import { createPinia } from "pinia";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory } from "vue-router";
import { beforeEach, expect, it, vi } from "vitest";
import App from "../App.vue";
import { createAppRouter } from "./index";

vi.mock("../services/cvWorkspace", () => ({
  cvWorkspace: {
    list: vi.fn().mockResolvedValue([]),
    open: vi.fn().mockResolvedValue(null),
  },
}));
vi.mock("../services/blockLibrary", () => ({
  blockLibrary: { browse: vi.fn().mockResolvedValue({ blocks: [], experience: [], sidebar: {} }) },
}));
vi.mock("../supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "owner" } } } }),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn().mockResolvedValue({}),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function mountWorkspace(path) {
  const router = createAppRouter(createMemoryHistory(), {
    getSession: async () => ({ data: { session: { user: { id: "owner" } } } }),
  });
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
  expect(router.currentRoute.value.path).toBe("/app/cvs/new");
  expect(wrapper.get("h1").text()).toBe("New CV");
});

it.each([
  ["/cv", "/app/cvs"],
  ["/build", "/app/cvs/new"],
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

it("redirects an unauthenticated workspace visitor to login", async () => {
  const router = createAppRouter(createMemoryHistory(), {
    getSession: async () => ({ data: { session: null } }),
  });
  await router.push("/app/cvs");
  expect(router.currentRoute.value).toMatchObject({
    name: "Login",
    query: { redirect: "/app/cvs" },
  });
});
