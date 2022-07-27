import { createWebHistory, createRouter } from "vue-router";
import CV from "../views/CV.vue";
import CVBuilder from "../views/CVBuilder.vue";
import NotFound from "../views/NotFound.vue";

const routes = [
  {
    path: "/",
    name: "CV",
    component: CV,
  },
  {
    path: "/build",
    name: "CV Builder",
    component: CVBuilder,
  },
  // { path: "/:pathMatch(.*)*", name: "NotFound", component: NotFound },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
