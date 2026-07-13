<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { BLOCK_KINDS } from "../domain/blocks/blockLibrary";
import { blockLibrary } from "../services/blockLibrary";

const catalog = ref({ blocks: [], experience: [], sidebar: {} });
const status = ref("loading");
const error = ref("");
const filters = reactive({ search: "", kind: "", company: "", role: "" });
const form = reactive({ kind: "experience", title: "", value: "", employer: "", role: "" });
const saving = ref(false);
const editing = ref(null);
const editValue = ref("");
const instruction = ref("");
const proposal = ref(null);

function currentValue(block) {
  const content = block.currentVersion?.content || {};
  return content.text || content.name || content.institution || "";
}

function contentFor(kind, value) {
  if (kind === "experience") return { text: value };
  if (kind === "education") return { institution: value };
  return { name: value };
}

const visibleBlocks = computed(() => catalog.value.blocks.filter((block) => {
  if (filters.kind && block.kind !== filters.kind) return false;
  const context = block.contexts.find((item) => item.type === "employment");
  if (filters.company && context?.metadata?.company !== filters.company) return false;
  if (filters.role && context?.metadata?.role !== filters.role) return false;
  if (!filters.search.trim()) return true;
  return JSON.stringify(block).toLowerCase().includes(filters.search.trim().toLowerCase());
}));
const companies = computed(() => [...new Set(catalog.value.experience.map((group) => group.company))]);
const roles = computed(() => [...new Set(catalog.value.experience.flatMap((group) => group.roles.map((item) => item.role)))]);

async function load() {
  status.value = "loading";
  error.value = "";
  try { catalog.value = await blockLibrary.browse(); status.value = catalog.value.blocks.length ? "loaded" : "empty"; }
  catch (reason) { error.value = reason.message; status.value = "failed"; }
}

async function createBlock() {
  saving.value = true; error.value = "";
  try {
    const contexts = form.kind === "experience"
      ? [{ type: "employment", key: `${form.employer}-${form.role}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: `${form.employer} · ${form.role}`, metadata: { company: form.employer, role: form.role, companyId: form.employer.toLowerCase().replace(/[^a-z0-9]+/g, "-"), roleId: form.role.toLowerCase().replace(/[^a-z0-9]+/g, "-") } }]
      : [{ type: "sidebar", key: `${form.kind}s`, label: form.title, metadata: {} }];
    if (form.kind === "experience" && (!form.employer.trim() || !form.role.trim())) throw new Error("Employer and role are required for experience blocks.");
    await blockLibrary.saveVersion({ kind: form.kind, title: form.title, content: contentFor(form.kind, form.value), contexts });
    Object.assign(form, { kind: form.kind, title: "", value: "", employer: "", role: "" });
    await load();
  } catch (reason) { error.value = reason.message; }
  finally { saving.value = false; }
}

function edit(block) { editing.value = block; editValue.value = currentValue(block); proposal.value = null; }
async function saveEdit(content = contentFor(editing.value.kind, editValue.value), source = { type: "human" }) {
  saving.value = true;
  try { await blockLibrary.saveVersion({ blockId: editing.value.id, kind: editing.value.kind, content, basedOnVersionId: editing.value.currentVersion.id, source }); editing.value = null; proposal.value = null; await load(); }
  catch (reason) { error.value = reason.message; }
  finally { saving.value = false; }
}
async function suggest() {
  try { proposal.value = await blockLibrary.suggestVersion({ blockId: editing.value.id, basedOnVersionId: editing.value.currentVersion.id, instruction: instruction.value }); }
  catch (reason) { error.value = reason.message; }
}
</script>

<template>
  <section class="library-tools">
    <input v-model="filters.search" type="search" placeholder="Search blocks, companies, roles…" />
    <select v-model="filters.kind"><option value="">All block types</option><option v-for="kind in BLOCK_KINDS" :key="kind">{{ kind }}</option></select>
    <select v-model="filters.company"><option value="">All companies</option><option v-for="company in companies" :key="company">{{ company }}</option></select>
    <select v-model="filters.role"><option value="">All roles</option><option v-for="role in roles" :key="role">{{ role }}</option></select>
    <button class="secondary" @click="Object.assign(filters, { search: '', kind: '', company: '', role: '' })">Clear filters</button>
  </section>

  <details class="create-panel">
    <summary>Create reusable block</summary>
    <form @submit.prevent="createBlock">
      <div class="grid"><label>Type<select v-model="form.kind"><option v-for="kind in BLOCK_KINDS" :key="kind">{{ kind }}</option></select></label><label>Title<input v-model="form.title" required /></label></div>
      <div v-if="form.kind === 'experience'" class="grid"><label>Employer<input v-model="form.employer" required /></label><label>Role<input v-model="form.role" required /></label></div>
      <label>Content<textarea v-model="form.value" required></textarea></label>
      <button :aria-busy="saving" :disabled="saving">Save block</button>
    </form>
  </details>

  <p v-if="status === 'loading'" aria-busy="true">Loading block library…</p>
  <div v-if="error" role="alert"><p>{{ error }}</p><button class="secondary" @click="load">Try again</button></div>
  <section v-if="status === 'empty'" class="empty-state">No reusable blocks yet. Create the first one above.</section>
  <section class="block-grid">
    <article v-for="block in visibleBlocks" :key="block.id">
      <p class="kind">{{ block.kind }}</p><h3>{{ block.title }}</h3><p>{{ currentValue(block) }}</p>
      <footer><small>{{ block.versions.length }} version{{ block.versions.length === 1 ? '' : 's' }}</small><button class="secondary" @click="edit(block)">Edit & versions</button></footer>
    </article>
  </section>

  <dialog :open="Boolean(editing)">
    <article v-if="editing"><header><button aria-label="Close" rel="prev" @click="editing = null"></button><h2>{{ editing.title }}</h2></header>
      <label>New version<textarea v-model="editValue"></textarea></label><button :disabled="saving" @click="saveEdit()">Save immutable version</button>
      <details><summary>Version history</summary><ol><li v-for="version in [...editing.versions].reverse()" :key="version.id">v{{ version.number }} · {{ version.source.type }}<br /><small>{{ JSON.stringify(version.content) }}</small></li></ol></details>
      <hr /><label>AI change instruction<input v-model="instruction" placeholder="Emphasise stakeholder leadership…" /></label><button class="secondary" @click="suggest">Generate review proposal</button>
      <article v-if="proposal"><strong>Unsaved proposal</strong><p>{{ proposal.content.text || proposal.content.name || proposal.content.institution }}</p><div class="grid"><button @click="saveEdit(proposal.content, proposal.source)">Accept as new version</button><button class="secondary" @click="proposal = null">Reject</button></div></article>
    </article>
  </dialog>
</template>

<style scoped>.library-tools { display:grid; grid-template-columns:2fr repeat(3,1fr) auto; gap:.6rem; align-items:start; } .create-panel { margin:1rem 0 2rem; } .block-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:1rem; } .block-grid article { box-shadow:none; border:1px solid #dce3df; } .kind { color:#37624e; text-transform:uppercase; font-size:.7rem; letter-spacing:.12em; } footer { display:flex; justify-content:space-between; align-items:center; } dialog article { max-width:46rem; } @media(max-width:900px){.library-tools{grid-template-columns:1fr 1fr}} @media(max-width:600px){.library-tools{grid-template-columns:1fr}}</style>

