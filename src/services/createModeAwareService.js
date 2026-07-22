export function createModeAwareService({ primary, developer, developerAccessEnabled }) {
  return new Proxy({}, {
    get(_target, property) {
      const service = developerAccessEnabled() ? developer : primary;
      const value = service[property];
      return typeof value === "function" ? value.bind(service) : value;
    },
  });
}
