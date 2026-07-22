// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OpenRouterSettings from "./OpenRouterSettings.vue";
import { openRouter } from "../services/openRouter";

vi.mock("../services/openRouter", () => ({
  openRouter: {
    getStatus: vi.fn(),
    saveKey: vi.fn(),
    verifyKey: vi.fn(),
    removeKey: vi.fn(),
  },
}));

describe("OpenRouter settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openRouter.getStatus.mockResolvedValue({
      configured: false,
      model: "openrouter/auto",
      updatedAt: null,
    });
  });

  it("shows configuration status without rendering a stored secret", async () => {
    openRouter.getStatus.mockResolvedValue({
      configured: true,
      model: "openai/gpt-4.1-mini",
      updatedAt: "2026-07-21T01:00:00.000Z",
    });

    const wrapper = mount(OpenRouterSettings);
    await flushPromises();

    expect(wrapper.text()).toContain("OpenRouter is connected");
    expect(wrapper.get('[name="model"]').element.value).toBe("openai/gpt-4.1-mini");
    expect(wrapper.get('[name="apiKey"]').element.value).toBe("");
    expect(wrapper.html()).not.toContain("vaultSecretId");
  });

  it("replaces the key, clears the field, and reports success", async () => {
    openRouter.saveKey.mockResolvedValue({
      configured: true,
      model: "openrouter/auto",
      updatedAt: "2026-07-21T01:00:00.000Z",
    });
    const wrapper = mount(OpenRouterSettings);
    await flushPromises();
    await wrapper.get('[name="apiKey"]').setValue("sk-or-secret");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(openRouter.saveKey).toHaveBeenCalledWith({
      apiKey: "sk-or-secret",
      model: "openrouter/auto",
    });
    expect(wrapper.get('[name="apiKey"]').element.value).toBe("");
    expect(wrapper.get('[role="status"]').text()).toContain("OpenRouter key saved");
  });

  it("shows a rejected-key error without marking the provider connected", async () => {
    openRouter.saveKey.mockRejectedValue(new Error("OpenRouter rejected that API key."));
    const wrapper = mount(OpenRouterSettings);
    await flushPromises();
    await wrapper.get('[name="apiKey"]').setValue("rejected-key");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe("OpenRouter rejected that API key.");
    expect(wrapper.text()).toContain("OpenRouter is not connected");
  });

  it("verifies and removes an existing Vault-backed configuration", async () => {
    openRouter.getStatus.mockResolvedValue({
      configured: true,
      model: "openai/gpt-4.1-mini",
      updatedAt: "2026-07-21T01:00:00.000Z",
    });
    openRouter.verifyKey.mockResolvedValue({
      configured: true,
      model: "openai/gpt-4.1-mini",
      updatedAt: "2026-07-21T01:00:00.000Z",
    });
    openRouter.removeKey.mockResolvedValue({
      configured: false,
      model: "openrouter/auto",
      updatedAt: null,
    });
    const wrapper = mount(OpenRouterSettings);
    await flushPromises();

    await wrapper.findAll("button").find((item) =>
      item.text() === "Verify connection").trigger("click");
    await flushPromises();
    expect(openRouter.verifyKey).toHaveBeenCalledOnce();
    expect(wrapper.get('[role="status"]').text()).toContain("verified");

    await wrapper.findAll("button").find((item) =>
      item.text() === "Remove OpenRouter").trigger("click");
    await flushPromises();
    expect(openRouter.removeKey).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain("OpenRouter is not connected");
  });
});
