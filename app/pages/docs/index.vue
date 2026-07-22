<script setup>
import { computed, ref } from "vue";

definePageMeta({ layout: "public" });

useSeoMeta({
  title: "Connect your AI assistant | Resume Studio",
  description: "A plain-language guide to connecting Resume Studio to ChatGPT or OpenCode.",
});

const endpoint = "https://cv.obair.tech/mcp";
const copied = ref(false);
const opencodeConfig = `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "resume-studio": {
      "type": "remote",
      "url": "${endpoint}",
      "enabled": true
    }
  }
}`;
const copyLabel = computed(() => copied.value ? "Copied" : "Copy connection address");

async function copyEndpoint() {
  await navigator.clipboard.writeText(endpoint);
  copied.value = true;
  window.setTimeout(() => {
    copied.value = false;
  }, 2000);
}
</script>

<template>
  <main class="docs-page">
    <header class="docs-hero">
      <p class="eyebrow">Resume Studio guide / MCP</p>
      <h1>Connect Resume Studio to your AI assistant</h1>
      <p class="hero-copy">
        MCP is a secure connection between Resume Studio and an AI chat app. Once connected,
        the app can look at your CVs and prepare suggested changes. Nothing is added to a CV
        until you review and apply it.
      </p>
      <div class="hero-actions">
        <UButton class="nuxt-ui-button" to="/app/settings/mcp" label="Open MCP settings" icon="i-lucide-settings-2" />
        <UButton
          class="nuxt-ui-button"
          to="#choose-your-chat-app"
          label="See connection steps"
          color="neutral"
          variant="outline"
          trailing-icon="i-lucide-arrow-down"
        />
      </div>
    </header>

    <UAlert
      class="control-note"
      color="neutral"
      variant="outline"
      icon="i-lucide-shield-check"
      title="Your CV stays under your control"
      description="The assistant can prepare a proposal, but Resume Studio waits for you to choose Apply before saving any change to a CV."
    />

    <section class="guide-section" aria-labelledby="before-heading">
      <p class="eyebrow">Before you start</p>
      <h2 id="before-heading">Turn on the connection in Resume Studio</h2>
      <ol class="steps-list">
        <li>
          <span class="step-number">1</span>
          <div><strong>Sign in to Resume Studio.</strong> Use the account that owns the CVs you want to work on.</div>
        </li>
        <li>
          <span class="step-number">2</span>
          <div><strong>Open MCP settings.</strong> You can use the button below or find MCP under Settings.</div>
        </li>
        <li>
          <span class="step-number">3</span>
          <div><strong>Choose Enable MCP.</strong> Leave this page open while you connect your chat app.</div>
        </li>
      </ol>
      <UButton class="nuxt-ui-button" to="/app/settings/mcp" label="Open MCP settings" icon="i-lucide-plug-zap" />

      <div class="endpoint-box">
        <div>
          <span class="endpoint-label">Connection address</span>
          <code>{{ endpoint }}</code>
        </div>
        <UButton
          class="nuxt-ui-button"
          :label="copyLabel"
          :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
          color="neutral"
          variant="outline"
          @click="copyEndpoint"
        />
      </div>
    </section>

    <section id="choose-your-chat-app" class="client-intro" aria-labelledby="choose-heading">
      <p class="eyebrow">Choose your chat app</p>
      <h2 id="choose-heading">Follow the steps for the app you use</h2>
      <p>You only need to connect each chat app once.</p>
    </section>

    <section id="chatgpt" class="guide-section client-guide" aria-labelledby="chatgpt-heading">
      <div class="client-heading">
        <div>
          <p class="eyebrow">ChatGPT</p>
          <h2 id="chatgpt-heading">Add Resume Studio to ChatGPT</h2>
        </div>
        <UIcon name="i-lucide-message-circle" class="client-icon" aria-hidden="true" />
      </div>

      <UAlert
        color="warning"
        variant="outline"
        icon="i-lucide-building-2"
        title="Check your ChatGPT workspace first"
        description="Custom MCP apps currently require ChatGPT Business, Enterprise, or Edu on the web. Your workspace admin or owner may need to enable Developer mode."
      />

      <ol class="steps-list">
        <li>
          <span class="step-number">1</span>
          <div><strong>Open ChatGPT on the web.</strong> Go to Settings, then Apps.</div>
        </li>
        <li>
          <span class="step-number">2</span>
          <div><strong>Turn on Developer mode if prompted.</strong> It may be under Advanced settings, or your workspace admin may need to enable it.</div>
        </li>
        <li>
          <span class="step-number">3</span>
          <div><strong>Choose Create.</strong> Name the app “Resume Studio” and paste the connection address shown above.</div>
        </li>
        <li>
          <span class="step-number">4</span>
          <div><strong>Choose OAuth, then Scan tools.</strong> Sign in to Resume Studio and allow the connection when asked.</div>
        </li>
        <li>
          <span class="step-number">5</span>
          <div><strong>Start a new chat.</strong> Select Resume Studio from Apps, then ask: “Show me my CVs before suggesting any changes.”</div>
        </li>
      </ol>
    </section>

    <section id="opencode" class="guide-section client-guide" aria-labelledby="opencode-heading">
      <div class="client-heading">
        <div>
          <p class="eyebrow">OpenCode</p>
          <h2 id="opencode-heading">Add Resume Studio to OpenCode</h2>
        </div>
        <UIcon name="i-lucide-terminal" class="client-icon" aria-hidden="true" />
      </div>
      <p>
        OpenCode needs a short settings entry before it can open the Resume Studio sign-in page.
        If someone helps manage OpenCode for you, you can send them the technical steps below.
      </p>

      <UCollapsible class="technical-steps">
        <UButton
          class="nuxt-ui-button technical-trigger"
          label="Show the OpenCode technical steps"
          color="neutral"
          variant="outline"
          trailing-icon="i-lucide-chevron-down"
          block
        />
        <template #content>
          <div class="technical-content">
            <p><strong>1. Add this to your project or global <code>opencode.json</code> file:</strong></p>
            <pre><code>{{ opencodeConfig }}</code></pre>
            <p><strong>2. Ask OpenCode to open the sign-in page:</strong></p>
            <pre><code>opencode mcp auth resume-studio</code></pre>
            <p>Sign in to Resume Studio in the browser window that opens, then approve the connection.</p>
            <p><strong>3. Check that the connection worked:</strong></p>
            <pre><code>opencode mcp auth list</code></pre>
          </div>
        </template>
      </UCollapsible>

      <p class="first-prompt">Once connected, try: <strong>“Show me my CVs before suggesting any changes.”</strong></p>
    </section>

    <section class="guide-section help-section" aria-labelledby="help-heading">
      <p class="eyebrow">If something does not work</p>
      <h2 id="help-heading">Three quick checks</h2>
      <dl>
        <div>
          <dt>I cannot find Create in ChatGPT.</dt>
          <dd>Your ChatGPT plan or workspace permissions may not include custom apps. Ask the workspace admin or owner to enable Developer mode.</dd>
        </div>
        <div>
          <dt>I am asked to sign in again.</dt>
          <dd>That is expected the first time you connect. Use the same Resume Studio account that owns your CVs.</dd>
        </div>
        <div>
          <dt>I want to disconnect.</dt>
          <dd>Disable MCP in Resume Studio settings, then remove Resume Studio from the connected apps in your chat client.</dd>
        </div>
      </dl>
    </section>
  </main>
</template>

<style scoped>
.docs-page { width: min(100%, 72rem); margin: 0 auto; padding: clamp(3rem, 8vw, 7rem) 0 6rem; }
.docs-hero { max-width: 58rem; padding-bottom: clamp(2.5rem, 6vw, 5rem); }
.docs-hero h1 { max-width: 13ch; margin: .45rem 0 1.25rem; font-size: clamp(3rem, 8vw, 6.6rem); font-weight: 500; line-height: .95; letter-spacing: -.045em; }
.hero-copy { max-width: 47rem; color: var(--muted); font-size: clamp(1.1rem, 2vw, 1.35rem); }
.hero-actions { display: flex; flex-wrap: wrap; gap: .75rem; margin-top: 2rem; }
.control-note { margin-bottom: 2rem; }
.guide-section { margin-top: 2rem; padding: clamp(1.5rem, 5vw, 3.5rem); border: 2px solid var(--ink); background: var(--paper-light); box-shadow: 8px 8px 0 var(--paper-deep); }
.guide-section h2, .client-intro h2 { max-width: 20ch; margin: .45rem 0 1.25rem; font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 500; line-height: 1.05; }
.steps-list { display: grid; gap: 0; margin: 2rem 0; padding: 0; list-style: none; }
.steps-list li { display: grid; grid-template-columns: 2.75rem 1fr; gap: 1rem; align-items: start; padding: 1.1rem 0; border-top: 1px solid var(--paper-deep); line-height: 1.6; }
.steps-list li:last-child { border-bottom: 1px solid var(--paper-deep); }
.step-number { display: grid; width: 2.3rem; height: 2.3rem; place-items: center; border: 1px solid var(--ink); background: var(--paper); font-family: var(--font-label); font-size: .75rem; font-weight: 900; }
.endpoint-box { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between; margin-top: 2rem; padding: 1rem; border: 1px solid var(--ink); background: var(--paper); }
.endpoint-box > div { display: grid; gap: .25rem; }
.endpoint-label { color: var(--muted); font-family: var(--font-label); font-size: .65rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.endpoint-box code { overflow-wrap: anywhere; }
.client-intro { padding: clamp(4rem, 10vw, 8rem) 0 1rem; }
.client-intro p:last-child { color: var(--muted); font-size: 1.1rem; }
.client-heading { display: flex; gap: 1rem; align-items: start; justify-content: space-between; }
.client-icon { flex: 0 0 auto; width: 2rem; height: 2rem; color: var(--marker-dark); }
.technical-steps { margin-top: 1.5rem; }
.technical-trigger { justify-content: space-between; }
.technical-content { padding: 1.25rem; border: 1px solid var(--ink); border-top: 0; background: var(--paper); }
.technical-content pre { overflow-x: auto; margin: .75rem 0 1.25rem; padding: 1rem; background: var(--ink); color: var(--paper-light); font-size: .78rem; line-height: 1.6; }
.first-prompt { margin: 1.5rem 0 0; padding-left: 1rem; border-left: 4px solid var(--marker); }
.help-section dl { margin: 2rem 0 0; }
.help-section dl > div { display: grid; grid-template-columns: minmax(12rem, .8fr) minmax(0, 1.5fr); gap: 1rem; padding: 1.25rem 0; border-top: 1px solid var(--paper-deep); }
.help-section dl > div:last-child { border-bottom: 1px solid var(--paper-deep); }
.help-section dt { font-weight: 800; }
.help-section dd { margin: 0; color: var(--muted); line-height: 1.6; }
@media (max-width: 640px) {
  .docs-page { padding-top: 2.5rem; }
  .docs-hero h1 { font-size: clamp(2.8rem, 15vw, 4.5rem); }
  .endpoint-box, .endpoint-box :deep(button) { width: 100%; }
  .help-section dl > div { grid-template-columns: 1fr; gap: .4rem; }
}
</style>
