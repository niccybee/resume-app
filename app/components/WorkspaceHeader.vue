<script setup>
import { useAuthStore } from "../../src/stores/authStore";
import {
  disableDeveloperAccess,
  isDeveloperAccessEnabled,
} from "../../src/auth/developerAccess";

const auth = useAuthStore();
const developerAccess = isDeveloperAccessEnabled();
const collapsed = defineModel("collapsed", { type: Boolean, default: false });
const navigation = [
  { label: "Saved CVs", icon: "i-lucide-files", to: "/app/cvs" },
  { label: "CV Blocks", icon: "i-lucide-library", to: "/app/blocks" },
  { label: "CV Builder", icon: "i-lucide-file-pen-line", to: "/app/cvs/new" },
  { label: "MCP settings", icon: "i-lucide-plug-zap", to: "/app/settings/mcp" },
  { label: "AI settings", icon: "i-lucide-sparkles", to: "/app/settings/ai" },
];

async function leaveWorkspace() {
  if (developerAccess) {
    disableDeveloperAccess();
    await navigateTo("/login", { replace: true });
    return;
  }

  await auth.signOut();
  await navigateTo("/login", { replace: true });
}
</script>

<template>
  <UDashboardSidebar
    id="workspace-navigation"
    data-workspace-navigation
    class="workspace-sidebar"
    resizable
    :min-size="18"
    :max-size="24"
  >
    <template #header>
      <div class="workspace-brand-row">
        <NuxtLink class="workspace-brand" to="/app/cvs" aria-label="Resume Studio saved CVs">
          <span class="workspace-brand-mark">RS</span>
          <span class="workspace-brand-copy">
            <strong>Resume Studio</strong>
            <small>Compose with evidence</small>
          </span>
        </NuxtLink>

        <UButton
          class="nuxt-ui-button workspace-sidebar-close"
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          aria-label="Close sidebar"
          title="Close sidebar"
          @click="collapsed = true"
        />
      </div>
    </template>

    <template #default>
      <p class="sidebar-label">Workspace index</p>
      <UNavigationMenu
        :items="navigation"
        orientation="vertical"
        :ui="{
          link: 'rounded-none border-b border-[var(--paper-deep)] font-medium',
          linkLeadingIcon: 'text-[var(--marker-dark)]'
        }"
      />

      <UAlert
        v-if="developerAccess"
        class="developer-access-notice"
        color="warning"
        variant="outline"
        icon="i-lucide-construction"
        title="Developer access"
        description="The workspace shell is open. Protected data and writes still require authentication."
      />
    </template>

    <template #footer>
      <UButton
        class="nuxt-ui-button leave-workspace"
        :label="developerAccess ? 'Exit developer access' : 'Sign out'"
        color="neutral"
        variant="outline"
        block
        :ui="{ label: 'whitespace-normal text-left leading-tight' }"
        @click="leaveWorkspace"
      />
    </template>
  </UDashboardSidebar>
</template>

<style scoped>
.workspace-sidebar {
  --ui-bg: var(--paper-light);
  border-right: 2px solid var(--ink);
}

.workspace-brand {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
  color: var(--ink);
  text-decoration: none;
}

.workspace-brand-row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.workspace-brand-mark {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  flex: 0 0 auto;
  place-items: center;
  border: 2px solid var(--ink);
  background: var(--marker);
  box-shadow: 3px 3px 0 var(--ink);
  font-family: var(--font-label);
  font-size: 0.72rem;
  font-weight: 900;
}

.workspace-brand-copy {
  display: grid;
  line-height: 1.15;
}

.workspace-brand-copy strong {
  font-family: var(--font-editorial);
  font-size: 1.15rem;
}

.workspace-brand-copy small,
.sidebar-label {
  color: var(--muted);
  font-family: var(--font-label);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sidebar-label {
  margin: 0 0 0.65rem;
}

.developer-access-notice {
  margin-top: 1.25rem;
}

.leave-workspace {
  box-shadow: none;
}

.workspace-sidebar-close {
  flex: 0 0 auto;
  box-shadow: none;
}

@media (max-width: 1023px) {
  .workspace-sidebar-close {
    display: none;
  }
}

@media print {
  .workspace-sidebar {
    display: none;
  }
}
</style>
