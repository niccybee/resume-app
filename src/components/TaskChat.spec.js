// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import TaskChat from "./TaskChat.vue";

describe("task composer", () => {
  it("reviews occasion-aware JSON before emitting tasks for creation", async () => {
    const wrapper = mount(TaskChat);

    await wrapper.get('[aria-label="Task instructions"]').setValue([
      "E2 as Marketing Manager from 2021-03 to 2022-06: Led lifecycle reporting",
      "E2 as Marketing Manager from 2024-02 to present: Rebuilt acquisition planning",
    ].join("\n"));
    await wrapper.get('[data-testid="generate-task-json"]').trigger("click");

    expect(wrapper.emitted("createTasks")).toBeUndefined();
    const review = JSON.parse(wrapper.get('[data-testid="task-json"]').text());
    expect(review).toMatchObject({
      type: "create_tasks",
      version: 1,
      tasks: [
        {
          employer: "E2",
          role: "Marketing Manager",
          startDate: "2021-03",
          endDate: "2022-06",
          item: "Led lifecycle reporting",
        },
        {
          employer: "E2",
          role: "Marketing Manager",
          startDate: "2024-02",
          endDate: "present",
          item: "Rebuilt acquisition planning",
        },
      ],
    });
    expect(new Set(review.tasks.map((task) => task.occasionId)).size).toBe(2);

    await wrapper.get('[data-testid="create-json-tasks"]').trigger("click");

    expect(wrapper.emitted("createTasks")?.[0]?.[0]).toEqual(review.tasks);
  });

  it("shows an error for an unsupported task payload version", async () => {
    const wrapper = mount(TaskChat);
    await wrapper.get('[aria-label="Task instructions"]').setValue(JSON.stringify({
      type: "create_tasks",
      version: 2,
      tasks: [{
        employer: "E2",
        role: "Growth Lead",
        startDate: "2024-02",
        item: "Built an acquisition roadmap",
      }],
    }));

    await wrapper.get('[data-testid="generate-task-json"]').trigger("click");

    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Unsupported task payload version",
    );
    expect(wrapper.find('[data-testid="task-json"]').exists()).toBe(false);
    expect(wrapper.emitted("createTasks")).toBeUndefined();
  });

  it("rejects a mixed submission instead of dropping malformed lines", async () => {
    const wrapper = mount(TaskChat);
    await wrapper.get('[aria-label="Task instructions"]').setValue([
      "E2 as Growth Lead from 2024-02 to present: Built an acquisition roadmap",
      "This line is missing its employment period",
    ].join("\n"));

    await wrapper.get('[data-testid="generate-task-json"]').trigger("click");

    expect(wrapper.get('[role="alert"]').text()).toContain("Line 2");
    expect(wrapper.find('[data-testid="task-json"]').exists()).toBe(false);
    expect(wrapper.emitted("createTasks")).toBeUndefined();
  });

  it("keeps reviewed JSON visible when task creation fails", async () => {
    const createTasksHandler = vi.fn().mockRejectedValue(
      new Error("The task blocks could not be saved."),
    );
    const wrapper = mount(TaskChat, { props: { createTasksHandler } });
    await wrapper.get('[aria-label="Task instructions"]').setValue(
      "E2 as Growth Lead from 2024-02 to present: Built an acquisition roadmap",
    );
    await wrapper.get('[data-testid="generate-task-json"]').trigger("click");

    await wrapper.get('[data-testid="create-json-tasks"]').trigger("click");
    await Promise.resolve();

    expect(createTasksHandler).toHaveBeenCalledOnce();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "The task blocks could not be saved.",
    );
    expect(wrapper.find('[data-testid="task-json"]').exists()).toBe(true);
  });
});
