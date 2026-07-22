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
  <section class="consent-shell">
    <UCard class="consent-panel" variant="outline" aria-labelledby="consent-heading">
      <template #header>
        <p class="eyebrow">Connect a chat client / OAuth</p>
        <h1 id="consent-heading">Allow access to Resume Studio?</h1>
      </template>

      <p v-if="loading" aria-busy="true">Checking this authorization request…</p>
      <UAlert
        v-else-if="error"
        color="error"
        variant="outline"
        icon="i-lucide-circle-alert"
        :description="error"
      />

      <template v-else-if="request">
        <div class="client-heading">
          <span class="client-mark" aria-hidden="true">MCP</span>
          <div>
            <p class="eyebrow">Requesting client</p>
            <h2>{{ request.client.name }}</h2>
          </div>
        </div>
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
        <UAlert
          color="warning"
          variant="outline"
          icon="i-lucide-shield-check"
          title="Explicit apply remains required"
          description="You can disconnect this client later. MCP writes still require a reviewed Change Proposal and explicit confirmation."
        />
      </template>

      <template v-if="request && !loading && !error" #footer>
        <div class="actions">
          <UButton
            class="nuxt-ui-button"
            label="Deny"
            color="neutral"
            variant="outline"
            :disabled="submitting"
            @click="decide('deny')"
          />
          <UButton
            class="nuxt-ui-button approve-action"
            label="Approve"
            trailing-icon="i-lucide-arrow-right"
            :loading="submitting"
            :disabled="submitting"
            @click="decide('approve')"
          />
        </div>
      </template>
    </UCard>
  </section>
</template>

<style scoped>
.consent-shell {
  display: grid;
  min-height: calc(100vh - var(--ui-header-height));
  padding: clamp(3rem, 8vw, 7rem) 0;
  place-items: center;
}

.consent-panel {
  width: min(100%, 44rem);
  border: 2px solid var(--ink);
  background: var(--paper-light);
  box-shadow: 10px 10px 0 var(--marker);
}

.consent-panel h1 {
  margin: 0.3rem 0 0;
  font-size: clamp(2.5rem, 6vw, 4.6rem);
  font-weight: 400;
  line-height: 0.92;
  letter-spacing: -0.05em;
}

.client-heading {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1.5rem;
}

.client-heading h2,
.client-heading p {
  margin: 0;
}

.client-mark {
  display: grid;
  width: 3.25rem;
  height: 3.25rem;
  place-items: center;
  border: 2px solid var(--ink);
  background: var(--marker-soft);
  font-family: var(--font-label);
  font-size: 0.68rem;
  font-weight: 900;
}

dl {
  display: grid;
  grid-template-columns: minmax(9rem, auto) 1fr;
  gap: 0;
  margin: 2rem 0;
  border-top: 1px solid var(--ink);
}

dt,
dd {
  margin: 0;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--paper-deep);
}

dt {
  font-family: var(--font-label);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

dd {
  min-width: 0;
  overflow-wrap: anywhere;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.approve-action {
  border: 1px solid var(--ink);
  background: var(--ink);
  box-shadow: 4px 4px 0 var(--marker);
  color: var(--paper-light);
}

@media (max-width: 560px) {
  dl {
    grid-template-columns: 1fr;
  }

  dt {
    padding-bottom: 0.1rem;
    border-bottom: 0;
  }

  dd {
    padding-top: 0.2rem;
  }
}
</style>
