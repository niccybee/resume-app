<script setup>
const route = useRoute();
const workspaceMain = ref(null);
const sidebarCollapsed = ref(false);

watch(
  () => route.fullPath,
  async () => {
    await nextTick();
    workspaceMain.value?.scrollTo({ top: 0, left: 0 });
  },
);
</script>

<template>
  <div data-layout="workspace">
    <UDashboardGroup storage="localStorage" storage-key="resume-studio-workspace-v2">
      <div v-show="!sidebarCollapsed" class="workspace-sidebar-shell">
        <WorkspaceHeader v-model:collapsed="sidebarCollapsed" />
      </div>

      <section ref="workspaceMain" class="workspace-main">
        <header class="workspace-page-header">
          <UDashboardSidebarToggle
            class="nuxt-ui-button workspace-menu-toggle"
            color="neutral"
            variant="outline"
          />
          <UButton
            v-if="sidebarCollapsed"
            class="nuxt-ui-button workspace-sidebar-reopen"
            color="neutral"
            variant="outline"
            icon="i-lucide-panel-left-open"
            aria-label="Open sidebar"
            title="Open sidebar"
            @click="sidebarCollapsed = false"
          />
          <div class="workspace-heading">
            <p class="eyebrow">Resume Studio / Workspace</p>
            <h1>{{ route.meta.title }}</h1>
            <p v-if="route.meta.description" class="workspace-description">
              {{ route.meta.description }}
            </p>
          </div>
          <span class="workspace-folio" aria-hidden="true">CV / {{ String(route.path.split('/').filter(Boolean).length).padStart(2, '0') }}</span>
        </header>

        <main class="workspace-content">
          <slot />
        </main>
      </section>
    </UDashboardGroup>
  </div>
</template>

<style scoped>
.workspace-main {
  display: flex;
  min-width: 0;
  min-height: 100vh;
  flex: 1;
  flex-direction: column;
  overflow: auto;
  background: rgb(243 236 223 / 86%);
}

.workspace-sidebar-shell {
  display: contents;
}

.workspace-page-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: start;
  padding: 1.5rem clamp(1.25rem, 3vw, 3rem);
  border-bottom: 2px solid var(--ink);
  background: var(--paper);
}

.workspace-menu-toggle {
  grid-column: 1;
  margin-top: 0.15rem;
}

.workspace-sidebar-reopen {
  grid-column: 1;
  margin-top: 0.15rem;
}

.workspace-heading {
  grid-column: 2;
}

.workspace-folio {
  grid-column: 3;
}

.workspace-heading .eyebrow {
  margin: 0 0 0.35rem;
}

.workspace-heading h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3.6rem);
  font-weight: 400;
  line-height: 0.95;
  letter-spacing: -0.045em;
}

.workspace-description {
  max-width: 48rem;
  margin: 0.6rem 0 0;
  color: var(--muted);
}

.workspace-folio {
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--ink);
  font-family: var(--font-label);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.workspace-content {
  width: 100%;
  max-width: 96rem;
  margin: 0 auto;
  padding: clamp(1.25rem, 3vw, 3rem);
}

@media (min-width: 1024px) {
  .workspace-menu-toggle {
    display: none;
  }

  .workspace-page-header {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
}

@media (max-width: 600px) {
  .workspace-page-header {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .workspace-folio {
    display: none;
  }
}

@media (max-width: 1023px) {
  .workspace-sidebar-reopen {
    display: none;
  }
}
</style>
