import { createApp } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import App from "./App.vue";

const pinia = createPinia();

const app = createApp(App);
console.log(pinia);
app.use(pinia);
app.use(router);
app.mount("#app");
