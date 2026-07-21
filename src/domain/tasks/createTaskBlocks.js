import {
  createEmploymentContext,
} from "../employment/occasion";

export async function createTaskBlocks({ blockLibrary, tasks }) {
  if (!blockLibrary) throw new Error("A block library is required.");
  const inputs = (tasks || []).map((task) => {
    const context = createEmploymentContext(task);
    const employment = context.metadata;
    const title = `${employment.role} at ${employment.employer}: ${task.item}`;
    return {
      kind: "experience",
      title,
      content: { text: task.item },
      contexts: [context],
      source: task.source || { type: "human", input: "task-chat" },
    };
  });
  const versions = await blockLibrary.saveVersions(inputs);
  return versions.map((version, index) => {
    const input = inputs[index];
    return {
      blockId: version.blockId,
      versionId: version.id,
      section: "experience",
      block: {
        title: input.title,
        kind: "experience",
        contexts: input.contexts,
        versionNumber: version.number,
      },
      content: version.content,
    };
  });
}
