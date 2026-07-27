<script setup>
definePageMeta({ layout: "public" });

useSeoMeta({
  title: "Docs | Resume Studio",
  description: "Plain-language guides for using Resume Studio.",
});
</script>

<template>
  <main class="docs-index">
    <header class="docs-intro">
      <p class="eyebrow">Resume Studio / Docs</p>
      <h1>Guides for working with your CVs</h1>
      <p>
        Start with a task below. Each guide explains what to do in plain language,
        with technical details available only when you need them.
      </p>
    </header>

    <section class="guide-list" aria-labelledby="guides-heading">
      <div class="section-heading">
        <p class="eyebrow">Available now</p>
        <h2 id="guides-heading">Choose a guide</h2>
      </div>

      <UCard class="guide-card" variant="outline">
        <template #header>
          <div class="guide-number">
            <span>01</span>
            <UIcon name="i-lucide-message-circle" aria-hidden="true" />
          </div>
        </template>

        <h3>Connect an AI assistant</h3>
        <p>
          Connect Resume Studio to ChatGPT or OpenCode, then ask your assistant
          to read your CVs and prepare changes for your review.
        </p>

        <template #footer>
          <UButton
            class="nuxt-ui-button"
            to="/docs/mcp"
            label="Open the MCP guide"
            trailing-icon="i-lucide-arrow-right"
          />
        </template>
      </UCard>
    </section>
  </main>
</template>

<style scoped>
.docs-index {
  width: min(100%, 72rem);
  margin: 0 auto;
  padding: clamp(3rem, 8vw, 7rem) 0 6rem;
}

.docs-intro {
  max-width: 54rem;
}

.docs-intro h1 {
  max-width: 14ch;
  margin: 0.45rem 0 1.25rem;
  font-size: clamp(3rem, 8vw, 6.6rem);
  font-weight: 500;
  line-height: 0.95;
  letter-spacing: -0.045em;
}

.docs-intro > p:last-child {
  max-width: 44rem;
  color: var(--muted);
  font-size: clamp(1.1rem, 2vw, 1.35rem);
}

.guide-list {
  margin-top: clamp(4rem, 10vw, 8rem);
}

.section-heading h2 {
  margin: 0.35rem 0 1.5rem;
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 500;
}

.guide-card {
  max-width: 38rem;
  border: 2px solid var(--ink);
  background: var(--paper-light);
  box-shadow: 8px 8px 0 var(--paper-deep);
}

.guide-number {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--marker-dark);
  font-family: var(--font-label);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.1em;
}

.guide-number svg {
  width: 1.5rem;
  height: 1.5rem;
}

.guide-card h3 {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 500;
  line-height: 1;
}

.guide-card p {
  color: var(--muted);
}

@media (max-width: 640px) {
  .docs-index {
    padding-top: 2.5rem;
  }

  .docs-intro h1 {
    font-size: clamp(2.8rem, 15vw, 4.5rem);
  }
}
</style>
