<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { BLOCK_KINDS } from "../domain/blocks/blockLibrary";
import { blockLibrary } from "../services/blockLibrary";
import { cvWorkspace } from "../services/cvWorkspace";
import { backfillLegacyHomepageBlocks } from "../domain/blocks/backfillLegacyHomepageBlocks";
import { createEmploymentContext, formatEmploymentPeriod, normalizeEmploymentGroup } from "../domain/employment/occasion";

const catalog = ref({ blocks: [], experience: [], sidebar: {} });
const status = ref("loading");
const error = ref("");
const filters = reactive({ search: "", kind: "", companyId: "", roleId: "", occasionId: "", section: "" });
const form = reactive({ kind: "experience", title: "", value: "", employer: "", role: "", startDate: "", endDate: "" });
const saving = ref(false);
const editing = ref(null);
const editValue = ref("");
const instruction = ref("");
const proposal = ref(null);
const reviewedProposal = ref(null);
const editingSessions = ref([]);
const editingSessionId = ref("");
const importing = ref(false);
const importResult = ref(null);

function currentValue(block) {
  const content = block.currentVersion?.content || {};
  return content.text || content.name || content.institution || "";
}

function contentFor(kind, value) {
  if (kind === "experience") return { text: value };
  if (kind === "education") return { institution: value };
  return { name: value };
}

const visibleBlocks = computed(() => catalog.value.blocks.filter((block) => block.status === "active").filter((block) => {
  if (filters.kind && block.kind !== filters.kind) return false;
  const employment = block.contexts.find((item) => item.type === "employment");
  const normalizedEmployment = normalizeEmploymentGroup(employment?.metadata);
  if (filters.section && !block.contexts.some((context) => context.type === "sidebar" && context.key === filters.section)) return false;
  if (filters.companyId && normalizedEmployment.employerId !== filters.companyId) return false;
  if (filters.roleId && normalizedEmployment.roleId !== filters.roleId) return false;
  if (filters.occasionId && normalizedEmployment.occasionId !== filters.occasionId) return false;
  if (!filters.search.trim()) return true;
  return JSON.stringify(block).toLowerCase().includes(filters.search.trim().toLowerCase());
}));
const archivedBlocks = computed(() => catalog.value.blocks.filter((block) => block.status === "archived"));
const visibleBlockIds = computed(() => new Set(visibleBlocks.value.map((block) => block.id)));
const visibleExperienceGroups = computed(() => {
  if (filters.kind && filters.kind !== "experience") return [];
  return catalog.value.experience.map((employer) => ({
    ...employer,
    occasions: employer.occasions.map((occasion) => ({
      ...occasion,
      blocks: occasion.blocks.filter((block) => visibleBlockIds.value.has(block.id)),
    })).filter((occasion) => occasion.blocks.length),
  })).filter((employer) => employer.occasions.length);
});
const visibleSidebarBlocks = computed(() => visibleBlocks.value.filter((block) => block.kind !== "experience"));
const employers = computed(() => catalog.value.experience.map((group) => ({ id: group.employerId, label: group.employer })));
const roles = computed(() => {
  const unique = new Map();
  for (const employer of catalog.value.experience) {
    for (const occasion of employer.occasions) unique.set(occasion.roleId, occasion.role);
  }
  return [...unique].map(([id, label]) => ({ id, label }));
});
const occasions = computed(() => catalog.value.experience.flatMap((employer) =>
  employer.occasions.map((occasion) => ({
    id: occasion.occasionId,
    label: `${employer.employer} · ${occasion.role} · ${formatEmploymentPeriod(occasion.startDate, occasion.endDate)}`,
  })),
));
const sidebarSections = computed(() => Object.keys(catalog.value.sidebar));
const blockKindFilterItems = BLOCK_KINDS.map((kind) => ({ label: kind, value: kind }));
const employerFilterItems = computed(() => employers.value.map((employer) => ({ label: employer.label, value: employer.id })));
const roleFilterItems = computed(() => roles.value.map((role) => ({ label: role.label, value: role.id })));
const occasionFilterItems = computed(() => occasions.value.map((occasion) => ({ label: occasion.label, value: occasion.id })));
const sidebarFilterItems = computed(() => sidebarSections.value.map((section) => ({ label: section, value: section })));
const editingSessionItems = computed(() => editingSessions.value.map((session) => ({ label: session.label, value: session.id })));

async function load() {
  status.value = "loading";
  error.value = "";
  try {
    catalog.value = await blockLibrary.browse({ includeArchived: true });
    status.value = catalog.value.blocks.length ? "loaded" : "empty";
    return true;
  } catch (reason) {
    error.value = reason.message;
    status.value = "failed";
    return false;
  }
}

async function createBlock() {
  saving.value = true; error.value = "";
  try {
    const employmentContext = createEmploymentContext({
      employer: form.employer,
      role: form.role,
      startDate: form.startDate,
      ...(form.endDate ? { endDate: form.endDate } : {}),
    });
    const contexts = form.kind === "experience"
      ? [employmentContext]
      : [{ type: "sidebar", key: `${form.kind}s`, label: form.title, metadata: {} }];
    if (form.kind === "experience" && (!form.employer.trim() || !form.role.trim() || !form.startDate)) throw new Error("Employer, role, and start period are required for experience blocks.");
    await blockLibrary.saveVersion({ kind: form.kind, title: form.title, content: contentFor(form.kind, form.value), contexts });
    Object.assign(form, { kind: form.kind, title: "", value: "", employer: "", role: "", startDate: "", endDate: "" });
    await load();
  } catch (reason) { error.value = reason.message; }
  finally { saving.value = false; }
}

async function loadEditingSessions() {
  const cvs = await cvWorkspace.list();
  const groups = await Promise.all(cvs.map(async (cv) => ({
    cv,
    sessions: (await cvWorkspace.editingSessions(cv.id)).filter((session) => session.status === "open"),
  })));
  editingSessions.value = groups.flatMap(({ cv, sessions }) => sessions.map((session) => ({
    ...session,
    label: `${cv.name} · Working Composition ${session.optimisticVersion}`,
  })));
  editingSessionId.value = editingSessions.value.length === 1 ? editingSessions.value[0].id : "";
}

async function edit(block) {
  editing.value = block;
  editValue.value = currentValue(block);
  proposal.value = null;
  reviewedProposal.value = null;
  try {
    await loadEditingSessions();
  } catch (reason) {
    error.value = reason.message;
  }
}

async function reviewEdit(content = contentFor(editing.value.kind, editValue.value), source = { type: "human" }) {
  saving.value = true;
  error.value = "";
  try {
    const session = editingSessions.value.find((candidate) => candidate.id === editingSessionId.value);
    if (!session) throw new Error("Choose an open Editing Session for this CV Block change.");
    reviewedProposal.value = await cvWorkspace.proposeContentChanges({
      schemaVersion: "1",
      target: { type: "editing_session", id: session.id },
      baseVersion: session.optimisticVersion,
      operations: [{
        type: "append_block_version",
        blockId: editing.value.id,
        basedOnVersionId: editing.value.currentVersion.id,
        schemaVersion: "1",
        content,
        source,
      }],
    });
    proposal.value = null;
  }
  catch (reason) {
    if (["conflict", "stale-block-version"].includes(reason.code)) {
      const editingId = editing.value.id;
      const refreshed = await load();
      if (!refreshed) {
        editing.value = null;
        error.value = "The CV Block changed, but the latest Block Version could not be loaded. Refresh the CV Block Library before reopening it.";
        return;
      }
      editing.value = catalog.value.blocks.find((block) => block.id === editingId) || null;
    }
    error.value = reason.message;
  }
  finally { saving.value = false; }
}

async function applyReviewedEdit() {
  saving.value = true;
  error.value = "";
  try {
    await cvWorkspace.applyChangeProposal(reviewedProposal.value.id);
    editing.value = null;
    proposal.value = null;
    reviewedProposal.value = null;
    await load();
  } catch (reason) {
    error.value = reason.message;
  } finally {
    saving.value = false;
  }
}

async function discardReviewedEdit() {
  saving.value = true;
  error.value = "";
  try {
    await cvWorkspace.discardChangeProposal(reviewedProposal.value.id);
    reviewedProposal.value = null;
  } catch (reason) {
    error.value = reason.message;
  } finally {
    saving.value = false;
  }
}
async function suggest() {
  try { proposal.value = await blockLibrary.suggestVersion({ blockId: editing.value.id, basedOnVersionId: editing.value.currentVersion.id, instruction: instruction.value }); }
  catch (reason) { error.value = reason.message; }
}

async function runBlockLifecycle(action, block) {
  saving.value = true;
  error.value = "";
  try {
    if (action === "duplicate") await blockLibrary.duplicateBlock(block.id);
    if (["archive", "restore"].includes(action)) {
      reviewedProposal.value = await cvWorkspace.proposeLifecycleChange({ operation: {
        type: action === "archive" ? "archive_cv_block" : "restore_cv_block",
        target: { type: "cv_block", id: block.id },
        baseVersionId: block.currentVersion.id,
      } });
    }
    if (action === "delete") await blockLibrary.deleteBlock(block.id);
    if (!["archive", "restore"].includes(action)) await load();
  } catch (reason) {
    error.value = reason.message;
  } finally {
    saving.value = false;
  }
}

async function importFormerHomepage() {
  importing.value = true;
  error.value = "";
  try {
    importResult.value = await backfillLegacyHomepageBlocks({ blockLibrary });
    await load();
  } catch (reason) {
    error.value = reason.message;
  } finally {
    importing.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="library-tools">
    <UInput v-model="filters.search" type="search" aria-label="Search CV Blocks, employers, roles…" placeholder="Search CV Blocks, employers, roles…" />
    <USelect v-model="filters.kind" :items="blockKindFilterItems" aria-label="CV Block type" placeholder="All CV Block types" />
    <USelect v-model="filters.companyId" :items="employerFilterItems" aria-label="Employer" placeholder="All employers" />
    <USelect v-model="filters.roleId" :items="roleFilterItems" aria-label="Role" placeholder="All roles" />
    <USelect v-model="filters.occasionId" :items="occasionFilterItems" aria-label="Employment Occasion" placeholder="All Employment Occasions" />
    <USelect v-model="filters.section" :items="sidebarFilterItems" aria-label="Sidebar section" placeholder="All sidebar sections" />
    <button class="secondary control-compact" @click="Object.assign(filters, { search: '', kind: '', companyId: '', roleId: '', occasionId: '', section: '' })">Clear filters</button>
  </section>

  <details class="create-panel">
    <summary>Create CV Block</summary>
    <form @submit.prevent="createBlock">
      <div class="grid"><label>Type<USelect v-model="form.kind" :items="BLOCK_KINDS" aria-label="CV Block type" /></label><label>Title<UInput v-model="form.title" required /></label></div>
      <div v-if="form.kind === 'experience'" class="grid"><label>Employer<UInput v-model="form.employer" required /></label><label>Role<UInput v-model="form.role" required /></label></div>
      <div v-if="form.kind === 'experience'" class="grid"><label>Start period<UInput v-model="form.startDate" type="month" required /></label><label>End period <small>(blank means present)</small><UInput v-model="form.endDate" type="month" /></label></div>
      <label>Content<UTextarea v-model="form.value" required /></label>
      <button :aria-busy="saving" :disabled="saving">Save CV Block</button>
    </form>
  </details>

  <article class="import-panel">
    <div>
      <strong>Former homepage CV</strong>
      <p>Import its employment achievements, skills, certifications, education, and interests. Safe to rerun.</p>
      <small v-if="importResult">Created {{ importResult.created }} · skipped {{ importResult.skipped }} · total {{ importResult.total }}</small>
    </div>
    <button :aria-busy="importing" :disabled="importing" @click="importFormerHomepage">Import former homepage CV</button>
  </article>

  <p v-if="status === 'loading'" aria-busy="true">Loading CV Block Library…</p>
  <div v-if="error" role="alert"><p>{{ error }}</p><button class="secondary" @click="load">Try again</button></div>
  <section v-if="status === 'empty'" class="empty-state">No CV Blocks yet. Create the first one above.</section>
  <section v-for="employer in visibleExperienceGroups" :key="employer.employerId" class="employer-group">
    <header><p class="kind">Employer</p><h2>{{ employer.employer }}</h2></header>
    <section v-for="occasion in employer.occasions" :key="occasion.occasionId" class="role-group">
      <h3>{{ occasion.role }}</h3>
      <p class="occasion-period">{{ formatEmploymentPeriod(occasion.startDate, occasion.endDate) }}</p>
      <div class="block-grid">
        <article v-for="block in occasion.blocks" :key="block.id">
          <p class="kind">Experience</p><h4>{{ block.title }}</h4><p>{{ currentValue(block) }}</p>
          <footer><small>{{ block.versions.length }} Block Version{{ block.versions.length === 1 ? '' : 's' }}</small><span class="block-actions"><button class="secondary control-compact" @click="edit(block)">Edit & Block Versions</button><button class="secondary control-compact" @click="runBlockLifecycle('duplicate', block)">Duplicate CV Block</button><button class="secondary control-compact" @click="runBlockLifecycle('archive', block)">Archive CV Block</button><button class="secondary control-compact" @click="runBlockLifecycle('delete', block)">Delete CV Block</button></span></footer>
        </article>
      </div>
    </section>
  </section>
  <section v-if="visibleSidebarBlocks.length" class="block-grid sidebar-blocks">
    <article v-for="block in visibleSidebarBlocks" :key="block.id">
      <p class="kind">{{ block.kind }}</p><h3>{{ block.title }}</h3><p>{{ currentValue(block) }}</p>
      <footer><small>{{ block.versions.length }} Block Version{{ block.versions.length === 1 ? '' : 's' }}</small><span class="block-actions"><button class="secondary control-compact" @click="edit(block)">Edit & Block Versions</button><button class="secondary control-compact" @click="runBlockLifecycle('duplicate', block)">Duplicate CV Block</button><button class="secondary control-compact" @click="runBlockLifecycle('archive', block)">Archive CV Block</button><button class="secondary control-compact" @click="runBlockLifecycle('delete', block)">Delete CV Block</button></span></footer>
    </article>
  </section>

  <details v-if="archivedBlocks.length" class="archived-blocks">
    <summary>Archived CV Blocks ({{ archivedBlocks.length }})</summary>
    <section class="block-grid">
      <article v-for="block in archivedBlocks" :key="block.id">
        <p class="kind">{{ block.kind }}</p><h3>{{ block.title }}</h3><p>{{ currentValue(block) }}</p>
        <button class="secondary control-compact" @click="runBlockLifecycle('restore', block)">Restore CV Block</button>
      </article>
    </section>
  </details>

  <article v-if="reviewedProposal?.operationType && reviewedProposal.operationType !== 'edit_content'" aria-label="Reviewed CV Block Lifecycle Change Proposal">
    <strong>Reviewed Change Proposal</strong>
    <p>Applying performs the reviewed {{ reviewedProposal.operationType.replaceAll('_', ' ') }} transition.</p>
    <div class="grid"><button :disabled="saving" @click="applyReviewedEdit">Apply reviewed Change Proposal</button><button class="secondary" :disabled="saving" @click="discardReviewedEdit">Discard reviewed Change Proposal</button></div>
  </article>

  <dialog :open="Boolean(editing)">
    <article v-if="editing"><header><button aria-label="Close" rel="prev" @click="editing = null"></button><h2>{{ editing.title }}</h2></header>
      <label>Editing Session<USelect v-model="editingSessionId" :items="editingSessionItems" aria-label="Editing Session" placeholder="Choose an open Editing Session" /></label>
      <p v-if="!editingSessions.length"><small>Start or resume an Editing Session before changing this CV Block.</small></p>
      <label>New Block Version<UTextarea v-model="editValue" /></label><button :disabled="saving || !editingSessionId" @click="reviewEdit()">Review Block Version Change</button>
      <details><summary>Block Version history</summary><ol><li v-for="version in [...editing.versions].reverse()" :key="version.id">v{{ version.number }} · {{ version.source.type }}<br /><small>{{ JSON.stringify(version.content) }}</small></li></ol></details>
      <hr /><label>AI change instruction<UInput v-model="instruction" placeholder="Emphasise stakeholder leadership…" /></label><button class="secondary" @click="suggest">Generate Change Proposal</button>
      <article v-if="proposal"><strong>Unsaved Change Proposal</strong><p>{{ proposal.content.text || proposal.content.name || proposal.content.institution }}</p><div class="grid"><button @click="reviewEdit(proposal.content, proposal.source)">Review as Change Proposal</button><button class="secondary" @click="proposal = null">Reject</button></div></article>
      <article v-if="reviewedProposal && (!reviewedProposal.operationType || reviewedProposal.operationType === 'edit_content')" aria-label="Reviewed Block Version Change Proposal"><strong>Reviewed Change Proposal</strong><p>Applying appends an immutable Block Version and advances Working Composition {{ reviewedProposal.baseOptimisticVersion }}.</p><div class="grid"><button :disabled="saving" @click="applyReviewedEdit">Apply reviewed Change Proposal</button><button class="secondary" :disabled="saving" @click="discardReviewedEdit">Discard reviewed Change Proposal</button></div></article>
    </article>
  </dialog>
</template>

<style scoped>
.library-tools { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .6rem; align-items: start; padding-bottom: 1.25rem; border-bottom: 1px solid var(--ink); }
.create-panel { margin: 1.5rem 0 2rem !important; }
.import-panel { display: flex; justify-content: space-between; align-items: center; gap: 2rem; border: 2px solid var(--ink) !important; background: var(--paper-light); box-shadow: 6px 6px 0 var(--paper-deep); }
.import-panel p { margin: .3rem 0; color: var(--muted); }
.import-panel button { width: auto; white-space: nowrap; }
.employer-group { margin: 2.5rem 0; padding-left: 1rem; border-left: 5px solid var(--marker); }
.employer-group > header { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 1px solid var(--ink); }
.employer-group > header h2 { margin: .15rem 0 .7rem; font-size: 2rem; font-weight: 400; }
.role-group { margin: 1.25rem 0 2rem; }
.role-group > h3 { margin-bottom: .2rem; font-size: 1.45rem; font-weight: 400; }
.occasion-period { margin-bottom: .75rem; color: var(--muted); font-family: var(--font-label); font-size: .72rem; }
.block-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
.block-grid article { border: 1px solid var(--ink) !important; background: var(--paper-light); box-shadow: 4px 4px 0 var(--paper-deep); }
.sidebar-blocks, .archived-blocks { margin-top: 2rem; }
.empty-state { margin-top: 1rem; padding: 2rem; border: 1px solid var(--ink); background: var(--paper-light); font-family: var(--font-editorial); font-size: 1.35rem; }
.kind { margin: 0 0 .5rem; color: var(--marker-dark); }
footer { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding-top: .8rem; border-top: 1px solid var(--paper-deep); }
.block-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .35rem; }
dialog { width: min(94vw, 50rem); border: 2px solid var(--ink); border-radius: 0; background: var(--paper); box-shadow: 10px 10px 0 var(--marker); }
dialog article { max-width: 46rem; }
@media (max-width: 1050px) { .import-panel { align-items: flex-start; flex-direction: column; } }
@media (max-width: 600px) { .library-tools { grid-template-columns: 1fr; } .employer-group { padding-left: .7rem; } footer { flex-direction: column; } .block-actions { justify-content: flex-start; } }
</style>
