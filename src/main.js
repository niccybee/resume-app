// src/main.ts
import { ViteSSG } from "vite-ssg/single-page";
import App from "./App.vue";
import { createPinia } from "pinia";
import { useCvStore } from "./stores/cvStore";

// `export const createApp` is required instead of the original `createApp(App).mount('#app')`
export const createApp = ViteSSG(App, ({ app, initialState }) => {
  const pinia = createPinia();
  app.use(pinia);

  if (import.meta.env.SSR) {
    // this will be stringified and set to window.__INITIAL_STATE__
    initialState.pinia = pinia.state.value;
  } else {
    // on the client side, we restore the state
    pinia.state.value = initialState.pinia || {};
  }
  const cvs = useCvStore(pinia);
  cvs.getCVs();
});
