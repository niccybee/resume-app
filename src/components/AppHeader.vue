<script setup>
import { useRoute } from "vue-router";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
auth.initialize();
async function signOut() { await auth.signOut(); router.push("/login"); }
</script>

<template>
  <header id="workspace-header" data-workspace-navigation>
    <nav>
      <ul>
        <li><strong>Resume workspace</strong></li>
      </ul>
      <ul>
        <li><RouterLink data-nav="cvs" to="/app/cvs">Saved CVs</RouterLink></li>
        <li><RouterLink data-nav="blocks" to="/app/blocks">Blocks</RouterLink></li>
        <li><RouterLink data-nav="builder" to="/app/builder">Builder</RouterLink></li>
        <li><button class="outline sign-out" @click="signOut">Sign out</button></li>
      </ul>
    </nav>
    <hr />
    <hgroup>
      <h1>{{ route.meta.title }}</h1>
      <p v-if="route.meta.description">{{ route.meta.description }}</p>
    </hgroup>
  </header>
</template>

<style>
.sign-out { width: auto; padding: .35rem .7rem; margin: 0; }
@media print {
  #workspace-header {
    display: none;
  }
}
</style>
