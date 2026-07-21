import {
  normalizeEmploymentGroup,
  slugifyEmploymentValue,
} from "../employment/occasion";

function normalizeTask(task, index) {
  const employer = task.employer?.trim();
  const role = task.role?.trim();
  const item = (task.item || task.task || task.description)?.trim();
  const startDate = task.startDate?.trim();
  const endDate = task.endDate?.trim() || "present";

  if (!employer || !role || !startDate || !item) {
    throw new Error(
      "Each task requires employer, role, startDate, and item text.",
    );
  }

  const employment = normalizeEmploymentGroup({
    employer,
    role,
    startDate,
    endDate,
    occasionId: task.occasionId,
  });

  return {
    id:
      task.id ||
      `chat-${employment.occasionId}-${slugifyEmploymentValue(item).slice(0, 32)}-${index + 1}`,
    ...employment,
    status: "draft",
    item,
    ...(task.source?.type === "ai"
      ? { source: { type: "ai", provider: task.source.provider || "openrouter" } }
      : {}),
  };
}

function parseLine(line) {
  const match = line.match(
    /^(?:at\s+)?(.+?)\s+as\s+(.+?)\s+from\s+(\d{4}(?:-\d{2}(?:-\d{2})?)?)\s+(?:to|-)\s+(present|\d{4}(?:-\d{2}(?:-\d{2})?)?)\s*:\s*(.+)$/i,
  );
  if (!match) return null;
  return {
    employer: match[1],
    role: match[2],
    startDate: match[3],
    endDate: match[4],
    item: match[5],
  };
}

export function parseTaskPrompt(input) {
  const prompt = input?.trim();
  if (!prompt) throw new Error("Describe at least one task.");

  let candidates;
  let parsed;
  try {
    parsed = JSON.parse(prompt);
  } catch {
    parsed = null;
  }

  if (parsed !== null) {
    if (
      !Array.isArray(parsed) &&
      (parsed.type !== undefined || parsed.version !== undefined) &&
      (parsed.type !== "create_tasks" || parsed.version !== 1)
    ) {
      throw new Error("Unsupported task payload version. Use create_tasks version 1.");
    }
    candidates = Array.isArray(parsed) ? parsed : parsed.tasks;
  } else {
    const lines = prompt
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    candidates = lines.map(parseLine);
    const invalidLine = candidates.findIndex((candidate) => !candidate);
    if (invalidLine >= 0) {
      throw new Error(
        `Line ${invalidLine + 1} must use ‘Employer as Role from YYYY-MM to present: task’.`,
      );
    }
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error(
      "Use JSON or ‘Employer as Role from YYYY-MM to present: task’.",
    );
  }

  return {
    type: "create_tasks",
    version: 1,
    tasks: candidates.map(normalizeTask),
  };
}
