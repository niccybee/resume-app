// src/main.ts
import { ViteSSG } from "vite-ssg/single-page";
import App from "./App.vue";
import { createPinia } from "pinia";
import { useCvStore } from "./stores/cvStore";

// `export const createApp` is required instead of the original `createApp(App).mount('#app')`
export const createApp = ViteSSG(App, ({ app, intialState }) => {
  const pinia = createPinia();
  app.use(pinia);
  const cvs = useCvStore(pinia);
  if (!cvs.ready) cvs.getCVs();
  if (import.meta.env.SSR) {
    intialState.pinia = pinia.state.value;
  } else {
    console.log(intialState);
  }
});
