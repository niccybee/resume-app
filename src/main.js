// import { createApp } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import { ViteSSG } from "vite-ssg";
import App from "./App.vue";

const pinia = createPinia();

// const app = createApp(App);
// console.log(pinia);
// app.use(pinia);
// app.use(router);
// app.mount("#app");0

export const createApp = ViteSSG(
  App,
  { routes },
  { app, router, routes, isClient, initialState }
);
