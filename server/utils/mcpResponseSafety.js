const OMITTED_KEYS = new Set([
  "operations",
  "normalizedOperations",
  "normalized_operations",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
]);

function cloneWithoutUnsafeKeys(value) {
  if (Array.isArray(value)) return value.map(cloneWithoutUnsafeKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !OMITTED_KEYS.has(key))
    .map(([key, item]) => [key, cloneWithoutUnsafeKeys(item)]));
}

export function sanitizeMcpChangeResponse(proposal) {
  return cloneWithoutUnsafeKeys(proposal);
}

function safeTarget(target) {
  if (!target || typeof target !== "object") return undefined;
  const allowed = [
    "id", "cvId", "blockId", "versionId", "revisionId", "editingSessionId",
    "status", "optimisticVersion", "currentVersionId", "publishedRevisionId",
  ];
  const entries = allowed
    .filter((key) => ["string", "number"].includes(typeof target[key]))
    .map((key) => [key, target[key]]);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function sanitizeMcpErrorContext(context) {
  if (!context || typeof context !== "object") return undefined;
  const safe = {};
  for (const key of [
    "reason", "blockId", "versionId", "currentVersionId", "revisionId",
    "editingSessionId", "cvId", "status", "optimisticVersion",
  ]) {
    if (["string", "number"].includes(typeof context[key])) safe[key] = context[key];
  }
  const target = safeTarget(context.target);
  if (target) safe.target = target;
  return Object.keys(safe).length ? safe : undefined;
}
