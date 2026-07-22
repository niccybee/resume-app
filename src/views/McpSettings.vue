<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { mcpSettings } from "../services/mcpSettings";

const status = reactive({ enabled: false, updatedAt: null });
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const message = ref("");
const endpoint = ref("https://cv.obair.tech/mcp");
const opencodeConfig = computed(() => JSON.stringify({
  $schema: "https://opencode.ai/config.json",
  mcp: {
    "resume-studio": {
      type: "remote",
      url: endpoint.value,
      enabled: true,
    },
  },
}, null, 2));

onMounted(async () => {
  if (window.location.hostname !== "localhost") {
    endpoint.value = `${window.location.origin}/mcp`;
  }
  try {
    Object.assign(status, await mcpSettings.getStatus());
  } catch (reason) {
    error.value = reason.message;
  } finally {
    loading.value = false;
  }
});

async function setEnabled(enabled) {
  error.value = "";
  message.value = "";
  saving.value = true;
  try {
    Object.assign(status, await mcpSettings.setEnabled(enabled));
    message.value = enabled
      ? "MCP access is enabled for your account. You can now connect a supported chat client."
      : "MCP access is disabled. Existing clients can no longer use Resume Studio tools.";
  } catch (reason) {
    error.value = reason.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <p v-if="loading" aria-busy="true">Checking MCP access…</p>
  <div v-else class="mcp-settings-grid">
    <section class="settings-panel">
      <p :class="['connection-state', { connected: status.enabled }]">
        <strong>{{ status.enabled ? "MCP is enabled" : "MCP is disabled" }}</strong>
      </p>
      <h2>Connect your CV workspace</h2>
      <p>
        Enabling MCP lets OAuth-connected chat clients read your Resume Studio data and create reviewed Change Proposals. No proposed write changes your CV until you explicitly apply it.
      </p>
      <p v-if="status.updatedAt"><small>Last changed {{ new Date(status.updatedAt).toLocaleString() }}</small></p>
      <p v-if="message" role="status">{{ message }}</p>
      <p v-if="error" role="alert">{{ error }}</p>

      <label>
        MCP endpoint
        <UInput :model-value="endpoint" name="mcpEndpoint" readonly />
      </label>

      <div class="settings-actions">
        <UButton
          v-if="!status.enabled"
          class="nuxt-ui-button"
          label="Enable MCP"
          icon="i-lucide-plug-zap"
          :loading="saving"
          :disabled="saving"
          @click="setEnabled(true)"
        />
        <UButton
          v-else
          class="nuxt-ui-button"
          label="Disable MCP"
          icon="i-lucide-unplug"
          color="neutral"
          variant="outline"
          :loading="saving"
          :disabled="saving"
          @click="setEnabled(false)"
        />
        <UButton
          class="nuxt-ui-button"
          to="/docs"
          label="Read the setup guide"
          color="neutral"
          variant="link"
          trailing-icon="i-lucide-arrow-right"
        />
      </div>
    </section>

    <section class="instructions-panel" aria-labelledby="chatgpt-heading">
      <p class="eyebrow">ChatGPT</p>
      <h2 id="chatgpt-heading">Add Resume Studio as an app</h2>
      <ol>
        <li>Enable MCP above.</li>
        <li>In ChatGPT web, enable Developer mode under <strong>Settings → Apps → Advanced settings</strong>.</li>
        <li>Choose <strong>Apps → Create</strong> and enter the MCP endpoint shown above.</li>
        <li>Select OAuth authentication, choose <strong>Scan tools</strong>, and sign in as your Resume Studio account.</li>
        <li>Create the draft app, start a new chat, and select Resume Studio from the tools menu.</li>
      </ol>
      <UAlert
        color="warning"
        variant="outline"
        icon="i-lucide-info"
        title="ChatGPT workspace requirement"
        description="Custom MCP apps currently require ChatGPT Business, Enterprise, or Edu on the web. A workspace admin or owner may need to enable Developer mode first."
      />
    </section>

    <section class="instructions-panel" aria-labelledby="opencode-heading">
      <p class="eyebrow">OpenCode</p>
      <h2 id="opencode-heading">Add the remote OAuth server</h2>
      <ol>
        <li>Enable MCP above.</li>
        <li>Add this entry to your project or global <code>opencode.json</code>.</li>
      </ol>
      <pre><code>{{ opencodeConfig }}</code></pre>
      <ol start="3">
        <li>Run <code>opencode mcp auth resume-studio</code> and complete sign-in in your browser.</li>
        <li>Run <code>opencode mcp list</code> to confirm the connection.</li>
        <li>Ask OpenCode to read your current CV before proposing a change.</li>
      </ol>
    </section>

    <UAlert
      class="revocation-note"
      color="neutral"
      variant="outline"
      icon="i-lucide-shield-check"
      title="Disconnecting"
      description="Disabling MCP blocks new Resume Studio requests immediately. Also remove or disconnect the app in your chat client when you want its stored OAuth grant removed."
    />
  </div>
</template>

<style scoped>
.mcp-settings-grid { display: grid; max-width: 70rem; gap: 1.5rem; }
.settings-panel,
.instructions-panel { padding: clamp(1.5rem, 4vw, 3rem); border: 2px solid var(--ink); background: var(--paper-light); box-shadow: 8px 8px 0 var(--paper-deep); }
.settings-panel h2,
.instructions-panel h2 { margin-top: .5rem; font-family: var(--font-editorial); font-size: clamp(1.6rem, 4vw, 2.35rem); }
.connection-state { display: inline-flex; margin-top: 0; padding: .3rem .45rem; border: 1px solid currentColor; color: var(--muted); font-family: var(--font-label); font-size: .7rem; letter-spacing: .06em; text-transform: uppercase; }
.connection-state.connected { color: var(--success); }
.settings-actions { display: flex; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--ink); }
.instructions-panel ol { display: grid; gap: .7rem; padding-left: 1.4rem; }
.instructions-panel pre { overflow-x: auto; padding: 1rem; border: 1px solid var(--ink); background: var(--ink); color: var(--paper-light); font-size: .78rem; }
.revocation-note { max-width: 70rem; }
@media (min-width: 62rem) {
  .mcp-settings-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .settings-panel,
  .revocation-note { grid-column: 1 / -1; }
}
</style>
