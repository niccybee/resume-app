<script setup>
import { ref } from "vue";

const evidenceItems = [
  "Turned complex product work into clear, measurable customer outcomes.",
  "Built reusable content systems that make focused applications faster.",
  "Connected strategy, design and delivery across multidisciplinary teams.",
];
const highlightedEvidence = ref(1);

function highlightEvidence(index) {
  highlightedEvidence.value = index;
}
</script>

<template>
  <div class="project-home">
    <section class="hero" aria-labelledby="home-heading">
      <div class="hero-copy">
        <p class="eyebrow">A working CV system</p>
        <h1 id="home-heading">Write once.<br /><span>Shape every CV.</span></h1>
        <p class="lede">
          Keep the strongest evidence from your career in one reusable library,
          then compose a focused CV for the role in front of you.
        </p>
        <div class="actions">
          <UButton
            class="nuxt-ui-button primary-action"
            to="/app/blocks"
            label="Open the workspace"
            trailing-icon="i-lucide-arrow-right"
          />
          <UButton
            class="nuxt-ui-button text-action"
            to="/login"
            label="Owner sign in"
            trailing-icon="i-lucide-arrow-right"
            color="neutral"
            variant="link"
          />
        </div>
      </div>

      <div
        class="document-stack"
        aria-label="A tailored CV assembled from reusable blocks"
        tabindex="0"
      >
        <div class="document document-back" aria-hidden="true"></div>
        <div class="document document-middle" aria-hidden="true"></div>
        <article class="document document-front">
          <header class="document-header">
            <div>
              <p class="document-name">Nicholas Benson</p>
              <p class="document-role">Digital product &amp; growth</p>
            </div>
            <span class="document-mark">NB</span>
          </header>
          <div class="document-rule"></div>
          <section class="document-section">
            <p class="document-label">Selected evidence</p>
            <button
              v-for="(evidence, index) in evidenceItems"
              :key="evidence"
              class="evidence-row"
              :class="{ active: highlightedEvidence === index }"
              type="button"
              :aria-pressed="highlightedEvidence === index"
              @mouseenter="highlightEvidence(index)"
              @focus="highlightEvidence(index)"
              @click="highlightEvidence(index)"
            >
              <span>{{ String(index + 1).padStart(2, "0") }}</span>
              <p>{{ evidence }}</p>
            </button>
          </section>
          <footer class="document-footer">
            <span>Role-specific draft</span>
            <strong>03 blocks selected</strong>
          </footer>
        </article>
      </div>
    </section>

    <section class="workflow" aria-labelledby="workflow-heading">
      <div class="workflow-intro">
        <p class="eyebrow">The project model</p>
        <h2 id="workflow-heading">A CV is a composition,<br />not a copy.</h2>
      </div>
      <ol class="workflow-list">
        <li>
          <span class="step-number">01</span>
          <div><h3>Store the evidence</h3><p>Capture achievements, skills and experience as reusable, versioned blocks.</p></div>
          <span class="status building">Building</span>
        </li>
        <li>
          <span class="step-number">02</span>
          <div><h3>Compose the argument</h3><p>Choose exact block versions and arrange them around the role you want.</p></div>
          <span class="status next">Next</span>
        </li>
        <li>
          <span class="step-number">03</span>
          <div><h3>Publish with intent</h3><p>Preview, theme and share only the CVs that are ready to be seen.</p></div>
          <span class="status planned">Planned</span>
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.project-home {
  margin-inline: calc(50% - 50vw);
  overflow: hidden;
  width: 100vw;
  background-color: var(--paper);
  background-image: linear-gradient(rgb(25 23 19 / 3%) 1px, transparent 1px), linear-gradient(90deg, rgb(25 23 19 / 3%) 1px, transparent 1px);
  background-size: 24px 24px;
}

.hero,
.workflow {
  margin: 0 auto;
  max-width: 1280px;
  padding-inline: clamp(1.5rem, 6vw, 5rem);
}

.hero {
  align-items: center;
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: clamp(3rem, 8vw, 7rem);
  min-height: min(760px, 78vh);
  padding-block: clamp(4.5rem, 9vw, 8rem);
}

.eyebrow {
  color: var(--marker-dark);
  font-family: var(--font-label);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.13em;
  margin-bottom: 1.2rem;
  text-transform: uppercase;
}

h1,
h2 {
  color: var(--ink);
  font-family: var(--font-editorial);
  font-weight: 400;
}

h1 {
  font-size: clamp(4rem, 8.1vw, 7.7rem);
  letter-spacing: -0.065em;
  line-height: 0.83;
  margin: 0;
}

h1 span {
  display: inline-block;
  position: relative;
  z-index: 0;
}

h1 span::after {
  background: var(--marker);
  bottom: 0.05em;
  content: "";
  height: 0.1em;
  left: 0.02em;
  position: absolute;
  transform: rotate(-1deg);
  width: 98%;
  z-index: -1;
}

.lede {
  color: var(--muted);
  font-size: clamp(1.05rem, 1.5vw, 1.3rem);
  line-height: 1.55;
  margin: 2.2rem 0 0;
  max-width: 38rem;
}

.actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin-top: 2.4rem;
}

.primary-action {
  background: var(--ink);
  border: 2px solid var(--ink);
  box-shadow: 6px 6px 0 var(--marker);
  color: var(--paper-light);
  font-family: var(--font-label);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 0.9rem 1.15rem;
  transition: box-shadow 120ms ease, transform 120ms ease;
}

.primary-action:hover {
  box-shadow: 3px 3px 0 var(--marker);
  color: var(--paper-light);
  transform: translate(3px, 3px);
}

.text-action {
  color: var(--ink);
  font-size: 0.95rem;
  font-weight: 700;
  font-family: var(--font-ui);
  text-decoration: underline;
  text-decoration-color: var(--marker);
  text-decoration-thickness: 2px;
  text-underline-offset: 0.3rem;
}

.document-stack {
  min-height: 540px;
  outline: none;
  position: relative;
}

.document {
  border: 2px solid var(--ink);
  height: 500px;
  position: absolute;
  transform-origin: center;
  transition:
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 260ms cubic-bezier(0.22, 1, 0.36, 1);
  width: min(100%, 390px);
}

.document-back {
  background: var(--marker);
  right: -1rem;
  top: 2rem;
  transform: rotate(7deg);
  z-index: 1;
}

.document-middle {
  background: var(--paper-deep);
  right: 0.5rem;
  top: 1rem;
  transform: rotate(2.5deg);
  z-index: 2;
}

.document-front {
  background: var(--paper-light);
  box-shadow: 12px 15px 0 rgb(25 23 19 / 10%);
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 1.8rem;
  right: 1.2rem;
  top: 0;
  transform: rotate(-1.5deg);
  z-index: 3;
}

.document-header { align-items: flex-start; background: transparent; display: flex; justify-content: space-between; margin: 0; padding: 0; }
.document-name { font-family: var(--font-editorial); font-size: 1.3rem; font-weight: 700; margin: 0; }
.document-role { color: var(--muted); font-size: 0.75rem; margin: 0.2rem 0 0; }
.document-mark { border: 2px solid var(--ink); font-family: var(--font-label); font-size: 0.7rem; font-weight: 800; padding: 0.35rem; }
.document-rule { background: var(--ink); height: 2px; margin: 1.4rem 0; }
.document-label { font-family: var(--font-label); font-size: 0.64rem; font-weight: 800; letter-spacing: 0.1em; margin-bottom: 0.8rem; text-transform: uppercase; }
.evidence-row { appearance: none; border: 0; border-top: 1px solid var(--paper-deep); border-radius: 0; color: var(--ink); cursor: pointer; display: grid; font: inherit; gap: 0.8rem; grid-template-columns: 1.5rem 1fr; margin-inline: -0.7rem; padding: 0.8rem 0.7rem; text-align: left; transition: background-color 150ms ease-out, color 150ms ease-out; width: calc(100% + 1.4rem); }
.evidence-row span { color: var(--muted); font-family: var(--font-label); font-size: 0.62rem; }
.evidence-row p { font-family: var(--font-editorial); font-size: 0.86rem; line-height: 1.4; margin: 0; }
.evidence-row.active { background: var(--marker-soft); }
.evidence-row:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; position: relative; z-index: 1; }
.document-footer { background: transparent; border-top: 2px solid var(--ink); display: flex; font-family: var(--font-label); font-size: 0.56rem; justify-content: space-between; margin: auto 0 0; padding: 0.8rem 0 0; text-transform: uppercase; }
.document-footer strong { color: var(--marker-dark); }

@media (hover: hover) and (pointer: fine) {
  .document-stack:hover .document-front {
    box-shadow: 18px 24px 0 rgb(25 23 19 / 12%);
    transform: translate3d(-10px, -16px, 0) rotate(-2.25deg);
  }

  .document-stack:hover .document-middle {
    transform: translate3d(8px, 12px, 0) rotate(4.5deg);
  }

  .document-stack:hover .document-back {
    transform: translate3d(18px, 24px, 0) rotate(9.5deg);
  }
}

.document-stack:focus-visible .document-front {
  box-shadow: 0 0 0 3px var(--marker), 18px 24px 0 rgb(25 23 19 / 12%);
  transform: translate3d(-10px, -16px, 0) rotate(-2.25deg);
}

.document-stack:focus-visible .document-middle {
  transform: translate3d(8px, 12px, 0) rotate(4.5deg);
}

.document-stack:focus-visible .document-back {
  transform: translate3d(18px, 24px, 0) rotate(9.5deg);
}

.workflow {
  border-top: 2px solid var(--ink);
  display: grid;
  gap: clamp(3rem, 8vw, 7rem);
  grid-template-columns: 0.8fr 1.2fr;
  padding-block: clamp(4rem, 7vw, 6.5rem);
}

.workflow h2 { font-size: clamp(2.4rem, 4.5vw, 4.2rem); letter-spacing: -0.04em; line-height: 0.98; margin: 0; }
.workflow-list { list-style: none; margin: 0; padding: 0; }
.workflow-list li { align-items: start; border-top: 1px solid var(--ink); display: grid; gap: 1.1rem; grid-template-columns: 2rem 1fr auto; padding: 1.3rem 0 1.5rem; }
.workflow-list li:last-child { border-bottom: 1px solid var(--ink); }
.step-number, .status { font-family: var(--font-label); font-size: 0.64rem; letter-spacing: 0.06em; text-transform: uppercase; }
.step-number { color: var(--marker-dark); padding-top: 0.25rem; }
.workflow-list h3 { color: var(--ink); font-family: var(--font-editorial); font-size: 1.25rem; margin: 0; }
.workflow-list p { color: var(--muted); font-size: 0.86rem; line-height: 1.45; margin: 0.35rem 0 0; max-width: 30rem; }
.status { border: 1px solid currentColor; padding: 0.25rem 0.4rem; }
.building { color: var(--success); }
.next { color: var(--marker-dark); }
.planned { color: var(--muted); }

@media (max-width: 800px) {
  .hero, .workflow { grid-template-columns: 1fr; }
  .hero { min-height: auto; }
  .document-stack { margin-inline: auto; min-height: 530px; width: min(90%, 410px); }
  .workflow { gap: 2.5rem; }
}

@media (max-width: 480px) {
  h1 { font-size: clamp(3.4rem, 17vw, 5rem); }
  .document-stack { min-height: 430px; }
  .document { height: 410px; }
  .document-front { padding: 1.25rem; right: 0.5rem; }
  .document-back { right: -0.5rem; }
  .evidence-row { padding-block: 0.6rem; }
  .workflow-list li { grid-template-columns: 1.5rem 1fr; }
  .status { grid-column: 2; justify-self: start; }
}

@media (prefers-reduced-motion: reduce) {
  .document {
    transition: none;
  }

  .document-stack:hover .document-front,
  .document-stack:focus-visible .document-front {
    box-shadow: 12px 15px 0 rgb(25 23 19 / 10%);
    transform: rotate(-1.5deg);
  }

  .document-stack:hover .document-middle,
  .document-stack:focus-visible .document-middle {
    transform: rotate(2.5deg);
  }

  .document-stack:hover .document-back,
  .document-stack:focus-visible .document-back {
    transform: rotate(7deg);
  }
}
</style>
