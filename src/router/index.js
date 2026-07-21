import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";
import CVList from "../views/CVList.vue";
import CVCustom from "../views/CVCustom.vue";
import NotFound from "../views/NotFound.vue";
import WorkspaceNotFound from "../views/WorkspaceNotFound.vue";
import PublicSiteLayout from "../layouts/PublicSiteLayout.vue";
import WorkspaceLayout from "../layouts/WorkspaceLayout.vue";
import Login from "../views/Login.vue";
import BlockLibraryView from "../views/BlockLibraryView.vue";
import CvDraftEditor from "../views/CvDraftEditor.vue";
import CvPreview from "../views/CvPreview.vue";
import OpenRouterSettings from "../views/OpenRouterSettings.vue";
import { supabase } from "../supabase";

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
      {
        path: "login",
        name: "Login",
        component: Login,
      },
    ],
  },
  {
    path: "/app",
    component: WorkspaceLayout,
    meta: { requiresAuth: true },
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
        component: BlockLibraryView,
        meta: {
          title: "Reusable blocks",
          description: "Find and select previously saved resume items",
        },
      },
      {
        path: "builder",
        redirect: { name: "Workspace New CV" },
      },
      {
        path: "cvs/new",
        name: "Workspace New CV",
        component: CvDraftEditor,
        meta: { title: "New CV", description: "Compose a role-specific CV from exact block versions" },
      },
      {
        path: "cvs/:cvId/preview",
        name: "Workspace CV Preview",
        component: CvPreview,
        meta: { title: "Private preview" },
      },
      {
        path: "cvs/:cvId",
        name: "Workspace CV Editor",
        component: CvDraftEditor,
        meta: { title: "CV editor", description: "Edit content, theme, preview, and publication" },
      },
      {
        path: "settings/ai",
        name: "Workspace AI Settings",
        component: OpenRouterSettings,
        meta: {
          title: "AI settings",
          description: "Connect OpenRouter without exposing provider secrets to the browser",
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
    redirect: { name: "Workspace New CV" },
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

export function createAppRouter(
  history = createWebHistory(),
  { getSession = () => supabase.auth.getSession() } = {},
) {
  const appRouter = createRouter({
    history,
    routes,
  });
  appRouter.beforeEach(async (to) => {
    if (!to.matched.some((record) => record.meta.requiresAuth)) return true;
    const { data } = await getSession();
    if (data?.session) return true;
    return { name: "Login", query: { redirect: to.fullPath } };
  });
  return appRouter;
}

const router = createAppRouter();

export default router;
