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
  {
    label: "Saved CVs",
    icon: "i-lucide-files",
    to: "/app/cvs",
    "aria-label": "Saved CVs",
  },
  {
    label: "CV Blocks",
    icon: "i-lucide-library",
    to: "/app/blocks",
    "aria-label": "CV Blocks",
  },
  {
    label: "CV Builder",
    icon: "i-lucide-file-pen-line",
    to: "/app/cvs/new",
    "aria-label": "CV Builder",
  },
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

const settingsItems = computed(() => [
  [
    {
      label: "MCP connection",
      icon: "i-lucide-plug-zap",
      to: "/app/settings/mcp",
    },
    {
      label: "Web AI connection",
      icon: "i-lucide-sparkles",
      to: "/app/settings/ai",
    },
  ],
  [
    {
      label: developerAccess ? "Exit developer access" : "Sign out",
      icon: "i-lucide-log-out",
      onSelect: leaveWorkspace,
    },
  ],
]);
</script>

<template>
  <UDashboardSidebar
    id="workspace-navigation"
    v-model:collapsed="collapsed"
    data-workspace-navigation
    class="workspace-sidebar"
    collapsible
    resizable
    :min-size="18"
    :max-size="24"
    :ui="{ header: 'h-28 items-stretch py-2' }"
  >
    <template #header="{ collapsed: isCollapsed }">
      <div class="workspace-sidebar-header">
        <div
          class="workspace-brand-slot"
          :class="{ 'workspace-brand-slot--collapsed': isCollapsed }"
        >
          <NuxtLink
            class="workspace-brand"
            to="/app/cvs"
            aria-label="Resume Studio saved CVs"
          >
            <span class="workspace-brand-mark">RS</span>
            <span v-if="!isCollapsed" class="workspace-brand-copy">
              <strong>Resume Studio</strong>
              <small>Compose with evidence</small>
            </span>
          </NuxtLink>
        </div>

        <div
          class="workspace-sidebar-toggle-row"
          :class="{ 'workspace-sidebar-toggle-row--collapsed': isCollapsed }"
        >
          <UDashboardSidebarCollapse
            class="nuxt-ui-button workspace-sidebar-collapse"
            color="neutral"
            variant="ghost"
            :icon="isCollapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
            :aria-label="isCollapsed ? 'Expand sidebar' : 'Minimize sidebar'"
            :title="isCollapsed ? 'Expand sidebar' : 'Minimize sidebar'"
          />
        </div>
      </div>
    </template>

    <template #default="{ collapsed: isCollapsed }">
      <p
        class="sidebar-label"
        :class="{ 'sidebar-label--collapsed': isCollapsed }"
      >
        Workspace index
      </p>
      <UNavigationMenu
        :items="navigation"
        orientation="vertical"
        :collapsed="isCollapsed"
        tooltip
        :ui="{
          link: 'rounded-none border-b border-[var(--paper-deep)] font-medium',
          linkLeadingIcon: 'text-[var(--marker-dark)]'
        }"
      />

      <UAlert
        v-if="developerAccess && !isCollapsed"
        class="developer-access-notice"
        color="warning"
        variant="outline"
        icon="i-lucide-construction"
        title="Developer access"
        description="The workspace shell is open. Protected data and writes still require authentication."
      />
    </template>

    <template #footer="{ collapsed: isCollapsed }">
      <UDropdownMenu
        :items="settingsItems"
        :content="{ side: 'right', align: 'end', sideOffset: 8 }"
      >
        <UButton
          class="nuxt-ui-button workspace-settings"
          icon="i-lucide-settings"
          :label="isCollapsed ? undefined : 'Settings'"
          color="neutral"
          variant="outline"
          :block="!isCollapsed"
          aria-label="Open settings menu"
          title="Settings"
          :ui="{ label: 'whitespace-normal text-left leading-tight' }"
        />
      </UDropdownMenu>
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
  width: 100%;
  height: 2.35rem;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
  color: var(--ink);
  text-decoration: none;
}

.workspace-sidebar-header {
  display: flex;
  width: 100%;
  min-width: 0;
  height: 100%;
  flex-direction: column;
  justify-content: center;
  gap: 0.5rem;
}

.workspace-brand-slot {
  display: flex;
  width: 100%;
  height: 2.35rem;
  min-width: 0;
  align-items: center;
}

.workspace-brand-slot--collapsed {
  justify-content: center;
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
  min-width: 0;
  overflow: hidden;
  line-height: 1.15;
}

.workspace-brand-copy strong,
.workspace-brand-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  height: 1rem;
  margin: 0 0 0.65rem;
  overflow: hidden;
  line-height: 1rem;
  white-space: nowrap;
}

.sidebar-label--collapsed {
  visibility: hidden;
}

.developer-access-notice {
  margin-top: 1.25rem;
}

.workspace-settings {
  box-shadow: none;
}

.workspace-sidebar-collapse {
  box-shadow: none;
}

.workspace-sidebar-toggle-row {
  display: flex;
  width: 100%;
  height: 2.35rem;
  align-items: center;
  justify-content: flex-end;
}

.workspace-sidebar-toggle-row--collapsed {
  justify-content: center;
}

@media print {
  .workspace-sidebar {
    display: none;
  }
}
</style>
