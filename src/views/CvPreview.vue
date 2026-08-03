<script setup>
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import CvDocument from "../components/CvDocument.vue";
import { cvWorkspace } from "../services/cvWorkspace";

const route = useRoute();
const status = ref("loading");
const document = ref(null);
const error = ref("");
const previewMode = ref("fit");
const previewScale = ref(1);
const previewStage = ref(null);
const previewPaper = ref(null);
let resizeObserver;
let resizeFrame;
let observedStageWidth = 0;

function updatePreviewScale() {
  if (!previewStage.value || !previewPaper.value) return;

  const stageStyle = window.getComputedStyle(previewStage.value);
  const horizontalPadding =
    Number.parseFloat(stageStyle.paddingLeft) + Number.parseFloat(stageStyle.paddingRight);
  const availableWidth = previewStage.value.clientWidth - horizontalPadding;
  const paperWidth = previewPaper.value.offsetWidth;

  if (availableWidth <= 0 || paperWidth <= 0) return;
  previewScale.value = Math.min(1, Math.max(.25, availableWidth / paperWidth));
}

function setPreviewMode(mode) {
  previewMode.value = mode;
  if (mode === "fit") nextTick(updatePreviewScale);
}

onMounted(async () => {
  try {
    document.value = await cvWorkspace.preview(route.params.cvId);
    status.value = "loaded";
    await nextTick();
    updatePreviewScale();

    if (typeof ResizeObserver !== "undefined" && previewStage.value) {
      resizeObserver = new ResizeObserver(([entry]) => {
        const nextWidth = entry?.contentRect.width || 0;
        if (Math.abs(nextWidth - observedStageWidth) < 1) return;

        observedStageWidth = nextWidth;
        if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(updatePreviewScale);
      });
      resizeObserver.observe(previewStage.value);
    }
  } catch (reason) {
    error.value = reason.message;
    status.value = reason.code === "not-found" ? "missing" : "failed";
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
});

function printDocument() {
  window.print();
}
</script>

<template>
  <p v-if="status === 'loading'" aria-busy="true">Loading A4 print preview…</p>
  <section v-else-if="status === 'missing'">
    <h2>Preview unavailable</h2>
    <p>This draft does not exist or is not available to this owner.</p>
  </section>
  <div v-else-if="status === 'failed'" role="alert">{{ error }}</div>
  <section v-else class="print-preview" aria-labelledby="print-preview-title">
    <nav class="preview-actions" aria-label="Print preview actions">
      <div class="preview-actions-copy">
        <p class="preview-eyebrow">Print studio</p>
        <h1 id="print-preview-title">A4 print preview</h1>
        <p>210 × 297 mm · Portrait · Print-safe</p>
      </div>
      <div class="preview-actions-links">
        <div class="preview-size-controls" role="group" aria-label="Preview size">
          <button
            class="nuxt-ui-button preview-size-button"
            :class="{ 'is-active': previewMode === 'fit' }"
            type="button"
            aria-label="Fit page to preview width"
            :aria-pressed="previewMode === 'fit'"
            @click="setPreviewMode('fit')"
          >
            Fit width
          </button>
          <button
            class="nuxt-ui-button preview-size-button"
            :class="{ 'is-active': previewMode === 'actual' }"
            type="button"
            aria-label="Show page at actual size"
            :aria-pressed="previewMode === 'actual'"
            @click="setPreviewMode('actual')"
          >
            Actual size
          </button>
        </div>
        <NuxtLink :to="`/app/cvs/${document.id}`">← Back to editor</NuxtLink>
        <button class="secondary print-action" type="button" @click="printDocument">
          Print / save PDF
        </button>
      </div>
    </nav>
    <div
      ref="previewStage"
      class="print-preview-stage"
      :class="`print-preview-stage--${previewMode}`"
    >
      <div
        ref="previewPaper"
        class="preview-paper"
        :data-preview-mode="previewMode"
        :style="{ '--preview-zoom': previewMode === 'fit' ? previewScale : 1 }"
      >
        <CvDocument :document="document" paper-size="A4" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.print-preview {
  display: grid;
  gap: 1rem;
}

.preview-actions {
  position: sticky;
  top: 1rem;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: .9rem 1rem;
  border: 1px solid var(--line, #d8d2c8);
  border-radius: .9rem;
  background: color-mix(in srgb, var(--surface, #fff) 94%, transparent);
  box-shadow: 0 12px 32px rgb(39 34 27 / 10%);
  backdrop-filter: blur(12px);
}

.preview-actions-copy h1,
.preview-actions-copy p {
  margin: 0;
}

.preview-actions-copy h1 {
  font-size: 1.05rem;
  line-height: 1.2;
}

.preview-actions-copy > p:last-child {
  margin-top: .18rem;
  color: var(--muted, #686158);
  font-size: .78rem;
}

.preview-eyebrow {
  color: var(--accent, #b44b30);
  font-size: .66rem;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.preview-actions-links {
  display: flex;
  align-items: center;
  gap: .8rem;
  white-space: nowrap;
}

.preview-size-controls {
  display: inline-flex;
  padding: 2px;
  border: 1px solid #b7bcc2;
  border-radius: .35rem;
  background: #eef0f2;
}

.preview-size-button {
  min-height: 2rem;
  padding: 0 .65rem;
  border: 0;
  border-radius: .2rem;
  background: transparent;
  color: #4b5056;
  font: 700 .66rem/1 var(--font-label, monospace);
  letter-spacing: .04em;
  text-transform: uppercase;
}

.preview-size-button.is-active {
  background: #fff;
  box-shadow: 0 1px 3px rgb(25 30 35 / 14%);
  color: var(--ink, #191713);
}

.print-preview-stage {
  display: flex;
  justify-content: center;
  overflow: auto;
  padding: clamp(1rem, 4vw, 3rem);
  border: 1px solid #c7ccd2;
  border-radius: .9rem;
  background: #dfe3e8;
}

.preview-paper {
  flex: 0 0 auto;
  width: 210mm;
  min-height: 297mm;
  zoom: var(--preview-zoom, 1);
}

.print-preview-stage :deep(.cv-document) {
  flex: 0 0 auto;
  box-shadow: 0 3mm 10mm rgb(30 27 22 / 20%);
}

@media (max-width: 700px) {
  .preview-actions {
    position: static;
    align-items: stretch;
    flex-direction: column;
  }

  .preview-actions-links {
    flex-wrap: wrap;
    justify-content: space-between;
  }

  .print-preview-stage {
    justify-content: center;
    padding: 1rem;
  }

  .print-preview-stage--actual {
    justify-content: flex-start;
  }

  .preview-size-controls {
    order: -1;
    width: 100%;
  }

  .preview-size-button {
    flex: 1;
  }
}

@media print {
  .preview-actions {
    display: none !important;
  }

  .print-preview,
  .print-preview-stage {
    display: block;
    overflow: visible;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: #fff;
  }

  .print-preview-stage :deep(.cv-document) {
    box-shadow: none;
  }

  .preview-paper {
    width: 210mm;
    min-height: 297mm;
    zoom: 1 !important;
  }
}
</style>
