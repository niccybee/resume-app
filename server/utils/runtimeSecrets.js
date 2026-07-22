export function resolveRuntimeSecret(
  configuredValue,
  environmentKey,
  environment = process.env,
) {
  const configured = typeof configuredValue === "string"
    ? configuredValue.trim()
    : "";
  if (configured) return configured;

  const runtimeValue = environment?.[environmentKey];
  return typeof runtimeValue === "string" ? runtimeValue.trim() : "";
}
