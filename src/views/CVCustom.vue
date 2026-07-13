<script setup>
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import CvDocument from "../components/CvDocument.vue";
import { cvWorkspace } from "../services/cvWorkspace";

const route = useRoute();
const status = ref("loading");
const document = ref(null);
const error = ref("");

onMounted(async () => {
  try {
    document.value = await cvWorkspace.getPublic(route.params.resume_name);
    status.value = document.value ? "loaded" : "unavailable";
  } catch (reason) {
    error.value = reason.message;
    status.value = "failed";
  }
});
function printDocument() { window.print(); }
</script>

<template>
  <p v-if="status === 'loading'" aria-busy="true">Loading CV…</p>
  <section v-else-if="status === 'unavailable'" class="empty-state"><h1>This CV isn’t available</h1><p>The link may be incorrect, private, or no longer published.</p></section>
  <section v-else-if="status === 'failed'" role="alert"><h1>We couldn’t load this CV</h1><p>{{ error }}</p></section>
  <template v-else>
    <nav class="print-actions"><span></span><button class="secondary" @click="printDocument">Print / save PDF</button></nav>
    <CvDocument :document="document" />
  </template>
</template>

<style scoped>@media print { .print-actions { display: none; } } .empty-state { text-align:center; padding: 15vh 0; }</style>
