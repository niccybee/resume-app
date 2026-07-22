<script setup>
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import CvDocument from "../components/CvDocument.vue";
import { cvWorkspace } from "../services/cvWorkspace";
const route=useRoute(); const status=ref("loading"); const document=ref(null); const error=ref("");
onMounted(async()=>{try{document.value=await cvWorkspace.preview(route.params.cvId);status.value="loaded"}catch(reason){error.value=reason.message;status.value=reason.code==="not-found"?"missing":"failed"}});
function printDocument(){ window.print(); }
</script>
<template><p v-if="status==='loading'" aria-busy="true">Loading private preview…</p><section v-else-if="status==='missing'"><h2>Preview unavailable</h2><p>This draft does not exist or is not available to this owner.</p></section><div v-else-if="status==='failed'" role="alert">{{ error }}</div><template v-else><nav class="preview-actions"><NuxtLink :to="`/app/cvs/${document.id}`">← Back to editor</NuxtLink><button class="secondary" @click="printDocument">Print / save PDF</button></nav><CvDocument :document="document" /></template></template>
<style scoped>@media print{.preview-actions{display:none}}</style>
