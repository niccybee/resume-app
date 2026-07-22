<script setup>
import { useAuthStore } from "../../src/stores/authStore";
import {
  disableDeveloperAccess,
  isDeveloperAccessEnabled,
} from "../../src/auth/developerAccess";

const route = useRoute();
const auth = useAuthStore();
const developerAccess = isDeveloperAccessEnabled();

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
  <header id="workspace-header" data-workspace-navigation>
    <nav>
      <ul>
        <li><strong>Resume Studio</strong></li>
      </ul>
      <ul>
        <li><NuxtLink data-nav="cvs" to="/app/cvs">Saved CVs</NuxtLink></li>
        <li><NuxtLink data-nav="blocks" to="/app/blocks">Blocks</NuxtLink></li>
        <li><NuxtLink data-nav="builder" to="/app/cvs/new">Builder</NuxtLink></li>
        <li><NuxtLink data-nav="settings" to="/app/settings/ai">AI settings</NuxtLink></li>
        <li><button class="outline sign-out control-compact" @click="leaveWorkspace">{{ developerAccess ? "Exit developer access" : "Sign out" }}</button></li>
      </ul>
    </nav>
    <p v-if="developerAccess" class="developer-access-notice" role="status">Developer access: the workspace shell is available, while protected data and writes still require authentication.</p>
    <hr>
    <hgroup>
      <h1>{{ route.meta.title }}</h1>
      <p v-if="route.meta.description">{{ route.meta.description }}</p>
    </hgroup>
  </header>
</template>

<style>
.sign-out { width: auto; padding: .35rem .7rem; margin: 0; }
.developer-access-notice { margin: .75rem 0 0; padding: .65rem .8rem; border: 1px solid #d8b76a; border-radius: 8px; background: #fff7df; color: #684f19; }
@media print {
  #workspace-header { display: none; }
}
</style>
