import {
  createEmploymentContext,
} from "../employment/occasion";

export async function createTaskBlocks({ blockLibrary, tasks }) {
  if (!blockLibrary) throw new Error("A block library is required.");
  const selections = [];

  for (const task of tasks || []) {
    const context = createEmploymentContext(task);
    const employment = context.metadata;
    const title = `${employment.role} at ${employment.employer}: ${task.item}`;
    const version = await blockLibrary.saveVersion({
      kind: "experience",
      title,
      content: { text: task.item },
      contexts: [context],
      source: { type: "human", input: "task-chat" },
    });

    selections.push({
      blockId: version.blockId,
      versionId: version.id,
      section: "experience",
      block: {
        title,
        kind: "experience",
        contexts: [context],
        versionNumber: version.number,
      },
      content: version.content,
    });
  }

  return selections;
}
