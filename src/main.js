// // import { createApp } from "vue";
// import { createPinia } from "pinia";
// import router from "./router";
// import { ViteSSG } from "vite-ssg";
// import App from "./App.vue";

// const pinia = createPinia();

// // const app = createApp(App);
// // console.log(pinia);
// // app.use(pinia);
// // app.use(router);
// // app.mount("#app");0

// export const createApp = ViteSSG(
//   App,
//   { routes },
//   { app, router, routes, isClient, initialState }
// );
// main.ts
import { ViteSSG } from "vite-ssg";
import { createPinia } from "pinia";
import routes from "virtual:generated-pages";
// use any store you configured that you need data from on start-up
import { useSettingStore, useCvStore, useItemsStore } from "./store/root";
import App from "./App.vue";

export const createApp = ViteSSG(
  App,
  { routes },
  ({ app, router, initialState }) => {
    const pinia = createPinia();
    app.use(pinia);

    if (import.meta.env.SSR) initialState.pinia = pinia.state.value;
    else pinia.state.value = initialState.pinia || {};

    router.beforeEach((to, from, next) => {
      const store = useStore(pinia);
      if (!store.ready)
        // perform the (user-implemented) store action to fill the store's state
        store.initialize();
      next();
    });
  }
);
