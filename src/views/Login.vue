<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";
import { isSupabaseConfigured } from "../supabase";

const email = ref("");
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

auth.initialize().then(() => {
  if (auth.user) router.replace(route.query.redirect || "/app/cvs");
});
</script>

<template>
  <section class="login-panel">
    <p class="eyebrow">Private workspace</p>
    <h1>Sign in to manage CVs</h1>
    <p>We’ll email the existing owner account a one-time secure link. Shared CV links remain unlisted and public only while published.</p>
    <form @submit.prevent="auth.requestMagicLink(email)">
      <label>Email <input v-model="email" type="email" autocomplete="email" required /></label>
      <button :aria-busy="auth.loading" :disabled="auth.loading || !isSupabaseConfigured">Send sign-in link</button>
    </form>
    <p v-if="!isSupabaseConfigured" role="alert">Add the PRM2 URL and publishable key to your local environment first.</p>
    <p v-if="auth.error" role="alert">{{ auth.error }}</p>
    <p v-if="auth.notice" class="notice">{{ auth.notice }}</p>
  </section>
</template>

<style scoped>.login-panel { max-width: 34rem; margin: 8vh auto; padding: 3rem; background: white; border: 1px solid #dde3df; border-radius: 20px; } .eyebrow { color: #37624e; text-transform: uppercase; font-weight: 700; letter-spacing: .12em; }</style>

