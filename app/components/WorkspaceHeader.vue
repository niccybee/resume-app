<script setup>
import { useAuthStore } from "../../src/stores/authStore";

const route = useRoute();
const auth = useAuthStore();

async function signOut() {
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
        <li><button class="outline sign-out control-compact" @click="signOut">Sign out</button></li>
      </ul>
    </nav>
    <hr>
    <hgroup>
      <h1>{{ route.meta.title }}</h1>
      <p v-if="route.meta.description">{{ route.meta.description }}</p>
    </hgroup>
  </header>
</template>

<style>
.sign-out { width: auto; padding: .35rem .7rem; margin: 0; }
@media print {
  #workspace-header { display: none; }
}
</style>
