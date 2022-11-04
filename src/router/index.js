import { createWebHistory, createRouter } from "vue-router";
import Home from "../views/Home.vue";
import CVBuilder from "../views/CVBuilder.vue";
import CVList from "../views/CVList.vue";
import CVCustom from "../views/CVCustom.vue";
import NotFound from "../views/NotFound.vue";

const routes = [
  {
    path: "/",
    name: "Home",
    component: Home,
  },
  {
    path: "/cv",
    name: "List",
    component: CVList,
  },
  {
    path: "/cv/:resume_name",
    name: "Resume",
    component: CVCustom,
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
