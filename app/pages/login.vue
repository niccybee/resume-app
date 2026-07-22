<script setup>
import { loginDestination } from "../../src/auth/navigation";
import {
  enableDeveloperAccess,
  isDeveloperAccessAvailable,
  isDeveloperAccessEnabled,
} from "../../src/auth/developerAccess";
import { useAuthStore } from "../../src/stores/authStore";
import { isSupabaseConfigured } from "../../src/supabase";

definePageMeta({ layout: "public" });

const email = ref("");
const route = useRoute();
const auth = useAuthStore();
const destination = computed(() => loginDestination(route.query.redirect));
const developerAccessAvailable = computed(() => (
  isDeveloperAccessAvailable() &&
  (destination.value === "/app" || destination.value.startsWith("/app/"))
));

await auth.initialize();
if (auth.user || (developerAccessAvailable.value && isDeveloperAccessEnabled())) {
  await navigateTo(destination.value, { replace: true });
}

async function requestMagicLink() {
  const redirectTo = new URL("/login", window.location.origin);
  redirectTo.searchParams.set("redirect", destination.value);
  await auth.requestMagicLink(email.value, redirectTo.href);
}

async function continueWithDeveloperAccess() {
  if (!enableDeveloperAccess()) return;
  await navigateTo(destination.value, { replace: true });
}
</script>

<template>
  <section class="login-shell">
    <div class="login-intro">
      <p class="eyebrow">Private workspace / Owner access</p>
      <h1>Return to your working documents.</h1>
      <p>
        Resume Studio keeps CV Blocks, Editing Sessions and exact CV Revisions
        behind the owner account. Public CV links stay separate.
      </p>
      <div class="login-sheet-stack" aria-hidden="true">
        <span />
        <span />
        <strong>CV<br>STUDIO</strong>
      </div>
    </div>

    <UCard class="login-panel" variant="outline">
      <template #header>
        <p class="panel-number">ACCESS / 01</p>
        <h2>Sign in to manage CVs</h2>
        <p>We’ll email the existing owner account a one-time secure link.</p>
      </template>

      <UForm :state="{ email }" class="login-form" @submit="requestMagicLink">
        <UFormField label="Email" name="email" required>
          <UInput
            v-model="email"
            class="w-full"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            icon="i-lucide-mail"
            required
          />
        </UFormField>
        <UButton
          class="nuxt-ui-button editorial-action"
          type="submit"
          label="Send sign-in link"
          icon="i-lucide-arrow-right"
          trailing
          block
          :loading="auth.loading"
          :disabled="auth.loading || !isSupabaseConfigured"
        />
      </UForm>

      <UAlert
        v-if="!isSupabaseConfigured"
        class="login-alert"
        color="warning"
        variant="outline"
        icon="i-lucide-triangle-alert"
        title="Local configuration required"
        description="Add the PRM2 URL and publishable key to your local environment first."
      />
      <UAlert
        v-if="auth.error"
        class="login-alert"
        color="error"
        variant="outline"
        icon="i-lucide-circle-alert"
        :description="auth.error"
      />
      <UAlert
        v-if="auth.notice"
        class="login-alert"
        color="success"
        variant="outline"
        icon="i-lucide-mail-check"
        :description="auth.notice"
      />

      <template v-if="developerAccessAvailable" #footer>
        <div class="developer-entry">
          <div>
            <p class="panel-number">LOCAL / DEV</p>
            <strong>Review the interface without a session</strong>
            <small>Protected data and writes still require Supabase authentication.</small>
          </div>
          <UButton
            class="nuxt-ui-button"
            type="button"
            label="Continue with developer access"
            color="neutral"
            variant="outline"
            @click="continueWithDeveloperAccess"
          />
        </div>
      </template>
    </UCard>
  </section>
</template>

<style scoped>
.login-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(22rem, 32rem);
  gap: clamp(2rem, 8vw, 7rem);
  align-items: center;
  min-height: calc(100vh - var(--ui-header-height));
  padding-block: clamp(3rem, 8vw, 7rem);
}

.login-intro h1 {
  max-width: 50rem;
  margin: 0;
  font-size: clamp(3.2rem, 7vw, 6.8rem);
  font-weight: 400;
  line-height: 0.87;
  letter-spacing: -0.06em;
}

.login-intro > p:last-of-type {
  max-width: 36rem;
  color: var(--muted);
  font-size: 1.05rem;
}

.login-sheet-stack {
  position: relative;
  width: 10rem;
  height: 7rem;
  margin-top: 2rem;
}

.login-sheet-stack span,
.login-sheet-stack strong {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border: 2px solid var(--ink);
}

.login-sheet-stack span:first-child {
  background: var(--marker);
  transform: rotate(8deg) translate(0.5rem, 0.25rem);
}

.login-sheet-stack span:nth-child(2) {
  background: var(--paper-deep);
  transform: rotate(3deg);
}

.login-sheet-stack strong {
  background: var(--paper-light);
  font-family: var(--font-label);
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-align: center;
  transform: rotate(-2deg) translate(-0.35rem, -0.15rem);
}

.login-panel {
  border: 2px solid var(--ink);
  background: var(--paper-light);
  box-shadow: 10px 10px 0 var(--marker);
}

.login-panel h2 {
  margin: 0.2rem 0 0.6rem;
  font-size: clamp(1.9rem, 4vw, 2.8rem);
  font-weight: 400;
  line-height: 1;
}

.login-panel p {
  margin: 0;
  color: var(--muted);
}

.panel-number {
  color: var(--marker-dark) !important;
  font-family: var(--font-label);
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.login-form {
  display: grid;
  gap: 1.25rem;
}

.editorial-action {
  margin-top: 0.4rem;
  border: 1px solid var(--ink);
  background: var(--ink);
  box-shadow: 5px 5px 0 var(--marker);
  color: var(--paper-light);
}

.login-alert {
  margin-top: 1rem;
}

.developer-entry {
  display: grid;
  gap: 1rem;
}

.developer-entry strong,
.developer-entry small {
  display: block;
}

.developer-entry small {
  margin-top: 0.35rem;
  color: var(--muted);
}

@media (max-width: 850px) {
  .login-shell {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .login-intro h1 {
    font-size: clamp(3rem, 14vw, 5rem);
  }
}
</style>
