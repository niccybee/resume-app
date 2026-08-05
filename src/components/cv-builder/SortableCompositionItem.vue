<script setup>
import { computed, ref } from "vue";
import { useSortable } from "@dnd-kit/vue/sortable";

const props = defineProps({
  id: { type: String, required: true },
  index: { type: Number, required: true },
  group: { type: String, required: true },
  label: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  tag: { type: String, default: "article" },
});

const element = ref(null);
const handle = ref(null);
const { isDragging, isDropTarget } = useSortable({
  id: computed(() => props.id),
  index: computed(() => props.index),
  group: computed(() => props.group),
  element,
  handle,
  disabled: computed(() => props.disabled),
  data: computed(() => ({ label: props.label, group: props.group })),
  transition: {
    duration: 180,
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  },
});
</script>

<template>
  <component
    :is="tag"
    ref="element"
    class="sortable-composition-item"
    :class="{
      'sortable-composition-item--dragging': isDragging,
      'sortable-composition-item--target': isDropTarget,
    }"
    :data-sortable-id="id"
  >
    <button
      ref="handle"
      type="button"
      class="sortable-composition-handle control-icon"
      :aria-label="`Reorder ${label}`"
      :disabled="disabled"
    >
      <UIcon name="i-lucide-grip-vertical" aria-hidden="true" />
    </button>
    <div class="sortable-composition-content">
      <slot />
    </div>
  </component>
</template>

<style scoped>
.sortable-composition-item {
  display: grid;
  grid-template-columns: var(--control-standard-height) minmax(0, 1fr);
  min-width: 0;
  padding: 0 !important;
  overflow: clip;
  border: 1px solid var(--ink) !important;
  background: var(--paper-light);
  box-shadow: 3px 3px 0 var(--paper-deep);
  transition:
    box-shadow 180ms ease,
    opacity 180ms ease;
}

.sortable-composition-item--dragging {
  z-index: 20;
  opacity: 0.72;
  box-shadow: 7px 7px 0 var(--marker);
}

.sortable-composition-item--target {
  outline: 2px solid var(--marker);
  outline-offset: 2px;
}

.sortable-composition-handle {
  align-self: stretch;
  height: auto !important;
  min-height: 100%;
  border: 0 !important;
  border-right: 1px solid var(--paper-deep) !important;
  background: transparent !important;
  box-shadow: none !important;
  color: var(--muted) !important;
  cursor: grab;
  touch-action: none;
  transform: none !important;
}

.sortable-composition-handle:active {
  cursor: grabbing;
}

.sortable-composition-content {
  min-width: 0;
}

@media (prefers-reduced-motion: reduce) {
  .sortable-composition-item {
    transition: none;
  }
}
</style>
