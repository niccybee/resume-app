import { routes as compatibilityRoutes } from "../src/router/routes";

export default {
  routes: (nativeRoutes) => [...nativeRoutes, ...compatibilityRoutes],
};
