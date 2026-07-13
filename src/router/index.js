import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";
import CVBuilder from "../views/CVBuilder.vue";
import CVList from "../views/CVList.vue";
import CVCustom from "../views/CVCustom.vue";
import NotFound from "../views/NotFound.vue";
import WorkspaceNotFound from "../views/WorkspaceNotFound.vue";
import PublicSiteLayout from "../layouts/PublicSiteLayout.vue";
import WorkspaceLayout from "../layouts/WorkspaceLayout.vue";

export const routes = [
  {
    path: "/",
    component: PublicSiteLayout,
    children: [
      {
        path: "",
        name: "Public Home",
        component: Home,
      },
      {
        path: "cv/:resume_name",
        name: "Public Resume",
        component: CVCustom,
      },
    ],
  },
  {
    path: "/app",
    component: WorkspaceLayout,
    children: [
      {
        path: "",
        redirect: { name: "Workspace CVs" },
      },
      {
        path: "cvs",
        name: "Workspace CVs",
        component: CVList,
        meta: { title: "Saved CVs" },
      },
      {
        path: "blocks",
        name: "Workspace Blocks",
        component: CVBuilder,
        meta: {
          title: "Reusable blocks",
          description: "Find and select previously saved resume items",
        },
      },
      {
        path: "builder",
        name: "Workspace Builder",
        component: CVBuilder,
        meta: {
          title: "CV builder",
          description: "Create a custom resume from your previously saved items",
        },
      },
      {
        path: ":pathMatch(.*)*",
        name: "Workspace Not Found",
        component: WorkspaceNotFound,
        meta: { title: "Workspace page not found" },
      },
    ],
  },
  {
    path: "/cv",
    redirect: { name: "Workspace CVs" },
  },
  {
    path: "/build",
    redirect: { name: "Workspace Builder" },
  },
  {
    path: "/:pathMatch(.*)*",
    component: PublicSiteLayout,
    children: [
      {
        path: "",
        name: "NotFound",
        component: NotFound,
      },
    ],
  },
];

export function createAppRouter(history = createWebHistory()) {
  return createRouter({
    history,
    routes,
  });
}

const router = createAppRouter();

export default router;
