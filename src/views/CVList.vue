<script setup>
import { onMounted, ref } from "vue";
import { resolveTheme } from "../domain/themes/themeRegistry";
import { cvWorkspace } from "../services/cvWorkspace";
const cvs=ref([]);const status=ref("loading");const error=ref("");
async function load(){status.value="loading";error.value="";try{cvs.value=await cvWorkspace.list();status.value=cvs.value.length?"loaded":"empty"}catch(reason){error.value=reason.message;status.value="failed"}}
onMounted(load);
</script>
<template><nav><ul><li><RouterLink role="button" to="/app/cvs/new">Create CV</RouterLink></li></ul></nav><p v-if="status==='loading'" aria-busy="true">Loading saved CVs…</p><section v-else-if="status==='empty'" class="empty-state"><h2>No saved CVs yet</h2><p>Create a role-focused CV from your reusable blocks.</p><RouterLink role="button" to="/app/cvs/new">Create the first CV</RouterLink></section><div v-else-if="status==='failed'" role="alert"><p>{{ error }}</p><button class="secondary" @click="load">Try again</button></div><section class="cv-list"><article v-for="cv in cvs" :key="cv.id"><p class="status">{{ cv.status }}</p><h2>{{ cv.name }}</h2><p>{{ resolveTheme(cv.themeId).name }} theme</p><footer><RouterLink :to="`/app/cvs/${cv.id}`">Edit</RouterLink><RouterLink :to="`/app/cvs/${cv.id}/preview`">Preview</RouterLink><RouterLink v-if="cv.status==='published'" :to="`/cv/${cv.slug}`">Public link</RouterLink></footer></article></section></template>
<style scoped>.cv-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem}.cv-list article{box-shadow:none;border:1px solid #dce3df}.status{text-transform:uppercase;letter-spacing:.12em;color:#37624e;font-size:.7rem}.cv-list footer{display:flex;gap:1rem}.empty-state{text-align:center;padding:10vh 0}</style>
