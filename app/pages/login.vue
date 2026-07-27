<script setup>
import {
  clearPendingExternalAuthDestination,
  externalAuthCallbackUrl,
  loginDestination,
  pendingExternalAuthDestination,
  rememberExternalAuthDestination,
} from "../../src/auth/navigation";
import {
  enableDeveloperAccess,
  isDeveloperAccessAvailable,
  isDeveloperAccessEnabled,
} from "../../src/auth/developerAccess";
import { useAuthStore } from "../../src/stores/authStore";
import { isSupabaseConfigured } from "../../src/supabase";

definePageMeta({ layout: "public" });

const credentials = reactive({ email: "", password: "" });
const activeEmailMethod = ref("magic-link");
const route = useRoute();
const auth = useAuthStore();
const pendingDestination = ref(pendingExternalAuthDestination(window.localStorage));
const destination = computed(() => loginDestination(
  typeof route.query.redirect === "string"
    ? route.query.redirect
    : pendingDestination.value,
));
const resuming = ref(false);
const emailMethods = computed(() => [
  { label: "Magic link", value: "magic-link", slot: "magic-link", disabled: auth.loading },
  { label: "Password", value: "password", slot: "password", disabled: auth.loading },
]);
const googleButtonLabel = computed(() => {
  if (auth.pendingAction === "google") return "Connecting to Google…";
  if (auth.feedbackAction === "google" && auth.error) return "Try Google sign-in again";
  return "Continue with Google";
});
const magicLinkButtonLabel = computed(() => {
  if (auth.pendingAction === "magic-link") return "Sending secure link…";
  if (auth.feedbackAction === "magic-link" && auth.notice) return "Sign-in link sent";
  if (auth.feedbackAction === "magic-link" && auth.error) return "Try sending the link again";
  return "Send sign-in link";
});
const passwordButtonLabel = computed(() => {
  if (auth.pendingAction === "password") return "Signing in…";
  if (auth.feedbackAction === "password" && auth.error) return "Try password sign-in again";
  return "Sign in with password";
});
const developerAccessAvailable = computed(() => (
  isDeveloperAccessAvailable() &&
  (destination.value === "/app" || destination.value.startsWith("/app/"))
));

await auth.initialize();

async function resumeAuthenticatedDestination(user) {
  if (!user || resuming.value) return;
  resuming.value = true;
  const target = destination.value;
  try {
    await navigateTo(target, { replace: true });
    clearPendingExternalAuthDestination(window.localStorage);
  } finally {
    resuming.value = false;
  }
}

if (auth.user) {
  await resumeAuthenticatedDestination(auth.user);
} else if (developerAccessAvailable.value && isDeveloperAccessEnabled()) {
  await navigateTo(destination.value, { replace: true });
}

async function requestMagicLink() {
  rememberExternalAuthDestination(window.localStorage, destination.value);
  pendingDestination.value = destination.value;
  await auth.requestMagicLink(
    credentials.email,
    externalAuthCallbackUrl(window.location.origin),
  );
}

async function signInWithPassword() {
  const signedIn = await auth.signInWithPassword(credentials.email, credentials.password);
  if (signedIn) await resumeAuthenticatedDestination(auth.user);
}

async function signInWithGoogle() {
  rememberExternalAuthDestination(window.localStorage, destination.value);
  pendingDestination.value = destination.value;
  const oauthUrl = await auth.signInWithGoogle(
    externalAuthCallbackUrl(window.location.origin),
  );
  if (oauthUrl) window.location.assign(oauthUrl);
}

async function continueWithDeveloperAccess() {
  if (!enableDeveloperAccess()) return;
  await navigateTo(destination.value, { replace: true });
}

watch(activeEmailMethod, () => auth.clearFeedback());
watch(() => auth.user, (user) => {
  void resumeAuthenticatedDestination(user);
});
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
        <p>Choose Google, a one-time email link, or your account password.</p>
      </template>

      <div class="login-options">
        <UButton
          class="nuxt-ui-button google-action"
          type="button"
          :label="googleButtonLabel"
          color="neutral"
          variant="outline"
          block
          :loading="auth.pendingAction === 'google'"
          :disabled="auth.loading || !isSupabaseConfigured"
          @click="signInWithGoogle"
        >
          <template #leading>
            <span class="google-mark" aria-hidden="true">G</span>
          </template>
        </UButton>

        <USeparator label="or continue with email" />

        <UTabs
          v-model="activeEmailMethod"
          class="login-tabs"
          :items="emailMethods"
          color="neutral"
          variant="link"
          :ui="{
            list: 'border-default',
            indicator: 'bg-primary',
            trigger: 'font-label uppercase tracking-wider',
            content: 'pt-5',
          }"
        >
          <template #magic-link>
            <UForm :state="credentials" class="login-form" @submit="requestMagicLink">
              <UFormField label="Email" name="email" required>
                <UInput
                  v-model="credentials.email"
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
                :label="magicLinkButtonLabel"
                icon="i-lucide-arrow-right"
                trailing
                block
                :loading="auth.pendingAction === 'magic-link'"
                :disabled="auth.loading || !isSupabaseConfigured"
              />
            </UForm>
          </template>

          <template #password>
            <UForm :state="credentials" class="login-form" @submit="signInWithPassword">
              <UFormField label="Email" name="email" required>
                <UInput
                  v-model="credentials.email"
                  class="w-full"
                  type="email"
                  autocomplete="username"
                  placeholder="you@example.com"
                  icon="i-lucide-mail"
                  required
                />
              </UFormField>
              <UFormField label="Password" name="password" required>
                <UInput
                  v-model="credentials.password"
                  class="w-full"
                  type="password"
                  autocomplete="current-password"
                  placeholder="Enter your password"
                  icon="i-lucide-lock-keyhole"
                  required
                />
              </UFormField>
              <UButton
                class="nuxt-ui-button editorial-action"
                type="submit"
                :label="passwordButtonLabel"
                icon="i-lucide-log-in"
                trailing
                block
                :loading="auth.pendingAction === 'password'"
                :disabled="auth.loading || !isSupabaseConfigured"
              />
            </UForm>
          </template>
        </UTabs>
      </div>

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
            <small>Uses disposable sample CVs and CV Blocks. Supabase data is never read or changed.</small>
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

.login-options {
  display: grid;
  gap: 1.25rem;
}

.google-action {
  min-height: 3rem;
  border: 1px solid var(--ink);
  background: var(--paper-light);
  color: var(--ink);
}

.google-mark {
  display: grid;
  width: 1.35rem;
  height: 1.35rem;
  place-items: center;
  border: 1px solid var(--ink);
  border-radius: 50%;
  font-family: Arial, sans-serif;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1;
}

.login-tabs :deep([data-slot="trigger"]) {
  font-family: var(--font-label);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.login-tabs :deep([data-slot="indicator"]) {
  background: var(--marker);
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
