<script setup>
import {
  decideOAuthAuthorization,
  loadOAuthAuthorization,
} from "../../../src/auth/oauthConsent";
import { loginDestination } from "../../../src/auth/navigation";
import { supabase } from "../../../src/supabase";
import { useAuthStore } from "../../../src/stores/authStore";

definePageMeta({ layout: "public" });

const route = useRoute();
const auth = useAuthStore();
const request = ref(null);
const loading = ref(true);
const submitting = ref(false);
const error = ref("");
const authorizationId = computed(() => (
  typeof route.query.authorization_id === "string"
    ? route.query.authorization_id
    : ""
));
const exactRequest = computed(() => loginDestination(route.fullPath));

// Keep the Supabase OAuth methods explicit at the UI boundary. Supabase owns
// authorization-code + PKCE, refresh tokens, and dynamic client registration.
const oauth = {
  getAuthorizationDetails: (...args) => supabase.auth.oauth.getAuthorizationDetails(...args),
  approveAuthorization: (...args) => supabase.auth.oauth.approveAuthorization(...args),
  denyAuthorization: (...args) => supabase.auth.oauth.denyAuthorization(...args),
};

await auth.initialize();
if (!auth.user) {
  await navigateTo({
    path: "/login",
    query: { redirect: exactRequest.value },
  }, { replace: true });
} else {
  try {
    const result = await loadOAuthAuthorization({
      oauth,
      authorizationId: authorizationId.value,
      user: auth.user,
    });
    if (result.type === "redirect") {
      window.location.assign(result.redirectUrl);
    } else {
      request.value = result;
    }
  } catch (cause) {
    error.value = cause?.message || "This authorization request could not be loaded.";
  } finally {
    loading.value = false;
  }
}

async function decide(decision) {
  submitting.value = true;
  error.value = "";
  try {
    const redirectUrl = await decideOAuthAuthorization({
      oauth,
      authorizationId: authorizationId.value,
      decision,
    });
    window.location.assign(redirectUrl);
  } catch (cause) {
    error.value = cause?.message || "Your authorization decision could not be saved.";
    submitting.value = false;
  }
}
</script>

<template>
  <section class="consent-panel" aria-labelledby="consent-heading">
    <p class="eyebrow">Connect a chat client</p>
    <h1 id="consent-heading">Allow access to Resume Studio?</h1>

    <p v-if="loading">Checking this authorization request…</p>
    <p v-else-if="error" role="alert">{{ error }}</p>

    <template v-else-if="request">
      <h2>{{ request.client.name }}</h2>
      <p>
        This client is asking to act as your signed-in Resume Studio account.
        Its database access will remain limited by your existing account permissions.
      </p>
      <dl>
        <template v-if="request.client.uri">
          <dt>Client website</dt>
          <dd><a :href="request.client.uri" rel="noreferrer">{{ request.client.uri }}</a></dd>
        </template>
        <dt>Redirect destination</dt>
        <dd><code>{{ request.redirectUri }}</code></dd>
        <dt>Requested access</dt>
        <dd>{{ request.scopes.length ? request.scopes.join(", ") : "Account access" }}</dd>
      </dl>
      <p>You can disconnect the client later. Resume Studio will still require explicit apply confirmation before MCP writes.</p>
      <div class="actions">
        <button class="secondary" :disabled="submitting" @click="decide('deny')">Deny</button>
        <button :aria-busy="submitting" :disabled="submitting" @click="decide('approve')">Approve</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.consent-panel { max-width: 40rem; margin: 8vh auto; padding: 3rem; background: white; border: 1px solid #dde3df; border-radius: 20px; }
.eyebrow { color: #37624e; text-transform: uppercase; font-weight: 700; letter-spacing: .12em; }
h2 { margin-block-end: .5rem; }
dl { display: grid; grid-template-columns: minmax(9rem, auto) 1fr; gap: .65rem 1rem; margin: 2rem 0; }
dt { font-weight: 700; }
dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.actions { display: flex; justify-content: flex-end; gap: .75rem; margin-top: 2rem; }
.secondary { background: transparent; color: inherit; border: 1px solid currentColor; }
</style>
