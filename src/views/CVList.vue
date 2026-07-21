<script setup>
import { computed, onMounted, ref } from "vue";
import { resolveTheme } from "../domain/themes/themeRegistry";
import { cvWorkspace } from "../services/cvWorkspace";
const cvs=ref([]);const status=ref("loading");const error=ref("");
const activeCvs=computed(()=>cvs.value.filter((cv)=>cv.status!=="archived"));
const archivedCvs=computed(()=>cvs.value.filter((cv)=>cv.status==="archived"));
async function load(){status.value="loading";error.value="";try{cvs.value=await cvWorkspace.list();status.value=cvs.value.length?"loaded":"empty"}catch(reason){error.value=reason.message;status.value="failed"}}
onMounted(load);
</script>
<template><nav><ul><li><NuxtLink role="button" to="/app/cvs/new">Create CV</NuxtLink></li></ul></nav><p v-if="status==='loading'" aria-busy="true">Loading saved CVs…</p><section v-else-if="status==='empty'" class="empty-state"><h2>No saved CVs yet</h2><p>Create a role-focused CV from your CV Blocks.</p><NuxtLink role="button" to="/app/cvs/new">Create the first CV</NuxtLink></section><div v-else-if="status==='failed'" role="alert"><p>{{ error }}</p><button class="secondary" @click="load">Try again</button></div><template v-else><section class="cv-list"><article v-for="cv in activeCvs" :key="cv.id"><p class="status">{{ cv.status }}</p><h2>{{ cv.name }}</h2><p>{{ resolveTheme(cv.themeId).name }} theme</p><footer><NuxtLink :to="`/app/cvs/${cv.id}`">Edit CV</NuxtLink><NuxtLink :to="`/app/cvs/${cv.id}/preview`">Private preview</NuxtLink><NuxtLink v-if="cv.status==='published'" :to="`/cv/${cv.slug}`">Public link</NuxtLink></footer></article></section><details v-if="archivedCvs.length"><summary>Archived CVs ({{ archivedCvs.length }})</summary><section class="cv-list"><article v-for="cv in archivedCvs" :key="cv.id"><p class="status">Archived</p><h2>{{ cv.name }}</h2><footer><NuxtLink :to="`/app/cvs/${cv.id}`">Review archived CV</NuxtLink></footer></article></section></details></template></template>
<style scoped>.cv-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem}.cv-list article{box-shadow:none;border:1px solid #dce3df}.status{text-transform:uppercase;letter-spacing:.12em;color:#37624e;font-size:.7rem}.cv-list footer{display:flex;gap:1rem}.empty-state{text-align:center;padding:10vh 0}</style>
