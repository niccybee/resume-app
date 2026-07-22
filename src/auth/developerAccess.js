export const DEVELOPER_ACCESS_STORAGE_KEY = "resume-studio:developer-access";

function browserSessionStorage() {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

export function isDeveloperAccessAvailable({ dev = import.meta.dev } = {}) {
  return dev === true;
}

export function isDeveloperAccessEnabled({
  dev = import.meta.dev,
  storage = browserSessionStorage(),
} = {}) {
  if (!isDeveloperAccessAvailable({ dev }) || !storage) return false;

  try {
    return storage.getItem(DEVELOPER_ACCESS_STORAGE_KEY) === "enabled";
  } catch {
    return false;
  }
}

export function enableDeveloperAccess({
  dev = import.meta.dev,
  storage = browserSessionStorage(),
} = {}) {
  if (!isDeveloperAccessAvailable({ dev }) || !storage) return false;

  try {
    storage.setItem(DEVELOPER_ACCESS_STORAGE_KEY, "enabled");
    return true;
  } catch {
    return false;
  }
}

export function disableDeveloperAccess({ storage = browserSessionStorage() } = {}) {
  if (!storage) return;

  try {
    storage.removeItem(DEVELOPER_ACCESS_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
