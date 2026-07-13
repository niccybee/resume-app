<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import CvDocument from "../components/CvDocument.vue";
import { addSelection, groupExperienceSelections, moveSelection, normalizeDraft, removeSelection } from "../domain/cvs/cvDraft";
import { listThemes } from "../domain/themes/themeRegistry";
import { blockLibrary } from "../services/blockLibrary";
import { cvWorkspace } from "../services/cvWorkspace";

const route = useRoute(); const router = useRouter();
const status = ref("loading"); const error = ref(""); const saving = ref(false);
const blocks = ref([]); const proposal = ref(null); const instruction = ref(""); const publishSlug = ref("");
const selectedVersions = reactive({});
const draft = reactive(normalizeDraft({ name: "", profile: { basics: {} }, selections: [] }));
const themes = listThemes();

function replaceDraft(next) { Object.assign(draft, normalizeDraft(next)); }
function sectionFor(kind) { return { experience:"experience", skill:"skills", certification:"certifications", education:"education", interest:"interests" }[kind]; }
function add(block) { const version=block.versions.find((item)=>item.id===(selectedVersions[block.id]||block.currentVersion.id))||block.currentVersion; replaceDraft(addSelection(draft, { blockId:block.id, versionId:version.id, section:sectionFor(block.kind), block:{ title:block.title, kind:block.kind, contexts:block.contexts, versionNumber:version.number }, content:version.content })); }
function remove(versionId) { replaceDraft(removeSelection(draft, versionId)); }
function shift(item, delta) { replaceDraft(moveSelection(draft, item.versionId, item.section, item.order + delta)); }
function changeSection(item, section) { replaceDraft(moveSelection(draft, item.versionId, section, draft.selections.filter((entry)=>entry.section===section).length)); }
function clearDraft() { if (window.confirm("Clear every selected block from this draft?")) replaceDraft({ ...draft, selections: [] }); }
const selectedBySection = computed(() => Object.groupBy(draft.selections, (item) => item.section));
const selectedExperienceGroups = computed(() => groupExperienceSelections(selectedBySection.value.experience));

onMounted(async () => {
  try {
    const [catalog, existing] = await Promise.all([blockLibrary.browse(), route.params.cvId ? cvWorkspace.open(route.params.cvId) : Promise.resolve(null)]);
    blocks.value = catalog.blocks;
    for (const block of blocks.value) selectedVersions[block.id] = block.currentVersion?.id;
    if (existing) { replaceDraft(existing); publishSlug.value = existing.slug || ""; }
    status.value = "loaded";
  } catch (reason) { error.value = reason.message; status.value = reason.code === "not-found" ? "missing" : "failed"; }
});

async function save() { saving.value=true; error.value=""; try { const saved=await cvWorkspace.save(draft); replaceDraft(saved); if (!route.params.cvId) await router.replace(`/app/cvs/${saved.id}`); } catch(reason){error.value=reason.message;} finally{saving.value=false;} }
async function publish() { try { if (!draft.id) await save(); const saved=await cvWorkspace.publish(draft.id,publishSlug.value); replaceDraft(saved); publishSlug.value=saved.slug; } catch(reason){error.value=reason.message;} }
async function unpublish() { try { replaceDraft(await cvWorkspace.unpublish(draft.id)); } catch(reason){error.value=reason.message;} }
async function generateSummary() { try { proposal.value=await cvWorkspace.suggestSummary(draft,instruction.value); } catch(reason){error.value=reason.message;} }
</script>

<template>
  <p v-if="status === 'loading'" aria-busy="true">Loading CV workspace…</p>
  <section v-else-if="status === 'missing'"><h2>CV not found</h2><RouterLink to="/app/cvs">Return to saved CVs</RouterLink></section>
  <div v-else-if="status === 'failed'" role="alert">{{ error }}</div>
  <div v-else class="editor-layout">
    <section class="editor-controls">
      <div v-if="error" role="alert">{{ error }}</div>
      <label>CV name<input v-model="draft.name" placeholder="Product lead CV" /></label>
      <div class="grid"><label>Name<input v-model="draft.profile.basics.name" /></label><label>Target role<input v-model="draft.profile.basics.label" /></label></div>
      <label>Email<input v-model="draft.profile.basics.email" type="email" /></label>
      <label>Theme<select v-model="draft.themeId"><option :value="null">Default — Editorial</option><option v-for="theme in themes" :key="theme.id" :value="theme.id">{{ theme.name }} — {{ theme.description }}</option></select></label>
      <details><summary>Summary generator</summary><label>Direction<input v-model="instruction" placeholder="Focus on product leadership" /></label><button class="secondary" @click="generateSummary">Generate proposal</button><article v-if="proposal"><p>{{ proposal.text }}</p><div class="grid"><button @click="replaceDraft(cvWorkspace.acceptSummary(draft, proposal)); proposal=null">Accept</button><button class="secondary" @click="proposal=null">Reject</button></div></article></details>

      <h2>Reusable block library</h2>
      <p v-if="!blocks.length">No blocks available. <RouterLink to="/app/blocks">Create blocks first.</RouterLink></p>
      <article v-for="block in blocks" :key="block.id" class="library-row"><div><small>{{ block.kind }}</small><strong>{{ block.title }}</strong><select v-model="selectedVersions[block.id]" aria-label="Block version"><option v-for="version in [...block.versions].reverse()" :key="version.id" :value="version.id">Version {{ version.number }} · {{ version.source.type }}</option></select></div><button class="secondary" :disabled="draft.selections.some((item) => item.versionId === selectedVersions[block.id])" @click="add(block)">Add selected version</button></article>

      <h2>Draft composition</h2>
      <section class="section-list experience-composition"><h3>experience</h3><p v-if="!selectedExperienceGroups.length"><small>No selected blocks.</small></p><section v-for="employer in selectedExperienceGroups" :key="employer.employerId" class="selection-employer"><h4>{{ employer.employer }}</h4><div v-for="role in employer.roles" :key="role.roleId"><h5>{{ role.role }}</h5><article v-for="item in role.items" :key="item.versionId" class="selection"><span>{{ item.block?.title || item.content?.text }}</span><div><select :value="item.section" aria-label="CV section" @change="changeSection(item,$event.target.value)"><option v-for="target in ['experience','skills','certifications','education','interests']" :key="target">{{ target }}</option></select><button class="outline" :disabled="item.order === 0" @click="shift(item,-1)">↑</button><button class="outline" :disabled="item.order === selectedBySection.experience.length - 1" @click="shift(item,1)">↓</button><button class="secondary" @click="remove(item.versionId)">Remove</button></div></article></div></section></section>
      <section v-for="section in ['skills','certifications','education','interests']" :key="section" class="section-list"><h3>{{ section }}</h3><p v-if="!selectedBySection[section]?.length"><small>No selected blocks.</small></p><article v-for="item in selectedBySection[section]" :key="item.versionId" class="selection"><span>{{ item.block?.title || item.content?.text || item.content?.name }}</span><div><select :value="item.section" aria-label="CV section" @change="changeSection(item,$event.target.value)"><option v-for="target in ['experience','skills','certifications','education','interests']" :key="target">{{ target }}</option></select><button class="outline" :disabled="item.order === 0" @click="shift(item,-1)">↑</button><button class="outline" :disabled="item.order === selectedBySection[section].length - 1" @click="shift(item,1)">↓</button><button class="secondary" @click="remove(item.versionId)">Remove</button></div></article></section>
      <button v-if="draft.selections.length" class="secondary" @click="clearDraft">Clear draft…</button>
      <button :aria-busy="saving" :disabled="saving" @click="save">Save draft</button>
      <RouterLink v-if="draft.id" role="button" class="secondary" :to="`/app/cvs/${draft.id}/preview`">Private preview</RouterLink>
      <details v-if="draft.id"><summary>Publishing</summary><label>Public slug<input v-model="publishSlug" placeholder="product-lead" /></label><button v-if="draft.status !== 'published'" @click="publish">Publish unlisted link</button><template v-else><p><RouterLink :to="`/cv/${draft.slug}`" target="_blank">Open /cv/{{ draft.slug }}</RouterLink></p><button class="secondary" @click="unpublish">Unpublish</button></template></details>
    </section>
    <aside class="live-preview"><p><strong>Live preview</strong></p><CvDocument :document="draft" /></aside>
  </div>
</template>

<style scoped>.editor-layout{display:grid;grid-template-columns:minmax(22rem,.8fr) minmax(36rem,1.2fr);gap:2rem;align-items:start}.editor-controls{min-width:0}.live-preview{position:sticky;top:1rem;transform-origin:top left}.library-row,.selection{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:.7rem;margin:.5rem 0;border:1px solid #dce3df;box-shadow:none}.library-row strong{display:block}.selection button{width:auto;padding:.35rem .6rem;margin:0 .15rem}.selection select{display:inline-block;width:auto;margin:0 .3rem}.section-list{margin:1.2rem 0}.selection-employer{margin:.75rem 0 1.25rem;padding-left:.75rem;border-left:3px solid #37624e}.selection-employer h4{margin:0 0 .6rem}.selection-employer h5{margin:.7rem 0 .35rem;color:#52635b}@media(max-width:1100px){.editor-layout{grid-template-columns:1fr}.live-preview{position:static}}@media print{.editor-controls{display:none}.editor-layout{display:block}}</style>
