<script setup>
import { onMounted, reactive, ref } from "vue";
import { openRouter } from "../services/openRouter";

const status = reactive({
  configured: false,
  model: "openrouter/auto",
  updatedAt: null,
});
const apiKey = ref("");
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const message = ref("");

function applyStatus(next) {
  Object.assign(status, next);
}

onMounted(async () => {
  try {
    applyStatus(await openRouter.getStatus());
  } catch (reason) {
    error.value = reason.message;
  } finally {
    loading.value = false;
  }
});

async function save() {
  error.value = "";
  message.value = "";
  saving.value = true;
  try {
    applyStatus(await openRouter.saveKey({
      apiKey: apiKey.value,
      model: status.model,
    }));
    apiKey.value = "";
    message.value = "OpenRouter key saved. The secret remains server-side.";
  } catch (reason) {
    error.value = reason.message;
  } finally {
    saving.value = false;
  }
}

async function disconnect() {
  error.value = "";
  message.value = "";
  saving.value = true;
  try {
    applyStatus(await openRouter.removeKey());
    apiKey.value = "";
    message.value = "OpenRouter disconnected and the stored key was deleted.";
  } catch (reason) {
    error.value = reason.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <p v-if="loading" aria-busy="true">Checking OpenRouter configuration…</p>
  <section v-else class="settings-panel">
    <p class="connection-state">
      <strong>{{ status.configured ? "OpenRouter is connected" : "OpenRouter is not connected" }}</strong>
    </p>
    <p>
      The API key is validated and stored in Supabase Vault. Its value is never returned to this browser.
    </p>
    <p v-if="status.updatedAt"><small>Last changed {{ new Date(status.updatedAt).toLocaleString() }}</small></p>
    <p v-if="message" role="status">{{ message }}</p>
    <p v-if="error" role="alert">{{ error }}</p>

    <form @submit.prevent="save">
      <label>
        OpenRouter API key
        <input
          v-model="apiKey"
          name="apiKey"
          type="password"
          autocomplete="new-password"
          placeholder="Paste a new key"
          required
        />
      </label>
      <label>
        Model
        <input
          v-model="status.model"
          name="model"
          autocomplete="off"
          placeholder="openrouter/auto"
          required
        />
      </label>
      <div class="settings-actions">
        <button class="control-standard" :disabled="saving" :aria-busy="saving" type="submit">
          {{ status.configured ? "Replace key" : "Connect OpenRouter" }}
        </button>
        <button
          v-if="status.configured"
          class="secondary control-standard"
          :disabled="saving"
          type="button"
          @click="disconnect"
        >
          Disconnect
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.settings-panel { max-width: 42rem; }
.connection-state { color: var(--success); }
.settings-actions { display: flex; flex-wrap: wrap; gap: .75rem; }
</style>
