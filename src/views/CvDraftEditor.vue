<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import CvDocument from "../components/CvDocument.vue";
import TaskChat from "../components/TaskChat.vue";
import { addSelection, groupExperienceSelections, moveSelection, normalizeDraft, removeSelection } from "../domain/cvs/cvDraft";
import { formatEmploymentPeriod } from "../domain/employment/occasion";
import { createTaskBlocks } from "../domain/tasks/createTaskBlocks";
import { listThemes } from "../domain/themes/themeRegistry";
import { blockLibrary } from "../services/blockLibrary";
import { cvWorkspace } from "../services/cvWorkspace";
import { openRouter } from "../services/openRouter";

const route = useRoute(); const router = useRouter();
const status = ref("loading"); const error = ref(""); const notice = ref(""); const saving = ref(false); const generatingSummary = ref(false);
const blocks = ref([]); const proposal = ref(null); const instruction = ref(""); const publishSlug = ref("");
const revisions = ref([]);
const editingSessions = ref([]);
const activeSession = ref(null);
const sessionChangeProposal = ref(null);
const proposingChange = ref(false);
const selectedVersions = reactive({});
const draft = reactive(normalizeDraft({ name: "", profile: { basics: {} }, selections: [] }));
const themes = listThemes();

function replaceDraft(next) { Object.assign(draft, normalizeDraft(next)); }
function sectionFor(kind) { return { experience:"experience", skill:"skills", certification:"certifications", education:"education", interest:"interests" }[kind]; }
function selectedVersion(block) { return block.versions.find((item)=>item.id===(selectedVersions[block.id]||block.currentVersion.id))||block.currentVersion; }
function selectionFor(block, version, section = sectionFor(block.kind)) { return { blockId:block.id, versionId:version.id, section, block:{ title:block.title, kind:block.kind, contexts:block.contexts, versionNumber:version.number }, content:version.content }; }
function selectedForBlock(blockId) { return draft.selections.find((item) => item.blockId === blockId); }
function add(block) { replaceDraft(addSelection(draft, selectionFor(block, selectedVersion(block)))); }
function replaceVersion(block) {
  const selected = selectedForBlock(block.id);
  if (!selected) return add(block);
  const replacement = { ...selectionFor(block, selectedVersion(block), selected.section), order: selected.order };
  replaceDraft({ ...draft, selections: draft.selections.map((item) => item.blockId === block.id ? replacement : item) });
}
function selectionVersionNumber(item) {
  if (item.block?.versionNumber) return item.block.versionNumber;
  return blocks.value.find((block) => block.id === item.blockId)?.versions.find((version) => version.id === item.versionId)?.number || "unknown";
}
function alignSelectedVersions() {
  for (const block of blocks.value) selectedVersions[block.id] = block.currentVersion?.id;
  for (const selection of draft.selections) selectedVersions[selection.blockId] = selection.versionId;
}
function remove(versionId) { replaceDraft(removeSelection(draft, versionId)); }
function shift(item, delta) { replaceDraft(moveSelection(draft, item.versionId, item.section, item.order + delta)); }
function changeSection(item, section) { replaceDraft(moveSelection(draft, item.versionId, section, draft.selections.filter((entry)=>entry.section===section).length)); }
function clearDraft() { if (window.confirm("Remove every selected Block Version from this CV?")) replaceDraft({ ...draft, selections: [] }); }
const selectedBySection = computed(() => Object.groupBy(draft.selections, (item) => item.section));
const selectedExperienceGroups = computed(() => groupExperienceSelections(selectedBySection.value.experience));
const openEditingSessions = computed(() => editingSessions.value.filter((item) => item.status === "open"));
const activeBaseRevisionNumber = computed(() => activeSession.value?.baseRevisionNumber || revisions.value.find((item) => item.id === activeSession.value?.baseRevisionId)?.number || null);

function activateEditingSession(session, baseRevisionNumber = null) {
  const publication = {
    slug: draft.slug,
    status: draft.status,
    publishedAt: draft.publishedAt,
  };
  activeSession.value = {
    ...session,
    baseRevisionNumber: session.baseRevisionNumber || baseRevisionNumber,
  };
  replaceDraft({
    ...publication,
    id: session.cvId,
    name: session.name,
    themeId: session.themeId,
    profile: session.profile,
    summary: session.summary,
    summaryProvenance: session.summaryProvenance,
    selections: session.selections,
  });
  alignSelectedVersions();
}

async function refreshEditingContext() {
  if (!draft.id) return;
  const [history, sessions] = await Promise.all([
    cvWorkspace.history(draft.id),
    cvWorkspace.editingSessions(draft.id),
  ]);
  revisions.value = history;
  editingSessions.value = sessions;
}

async function startEditingSession(revision) {
  error.value = "";
  notice.value = "";
  try {
    const session = await cvWorkspace.startEditingSession(draft.id, revision?.id || null);
    sessionChangeProposal.value = null;
    activateEditingSession(session, revision?.number || session.baseRevisionNumber);
    await refreshEditingContext();
  } catch (reason) {
    error.value = reason.message;
  }
}

async function resumeEditingSession(summary) {
  error.value = "";
  notice.value = "";
  try {
    const session = await cvWorkspace.resumeEditingSession(summary.id);
    sessionChangeProposal.value = null;
    activateEditingSession(session, summary.baseRevisionNumber);
  } catch (reason) {
    error.value = reason.message;
  }
}

onMounted(async () => {
  try {
    const [catalog, existing, history, sessions] = await Promise.all([
      blockLibrary.browse(),
      route.params.cvId ? cvWorkspace.open(route.params.cvId) : Promise.resolve(null),
      route.params.cvId ? cvWorkspace.history(route.params.cvId) : Promise.resolve([]),
      route.params.cvId ? cvWorkspace.editingSessions(route.params.cvId) : Promise.resolve([]),
    ]);
    blocks.value = catalog.blocks;
    revisions.value = history;
    editingSessions.value = sessions;
    if (existing) {
      replaceDraft(existing);
      publishSlug.value = existing.slug || "";
    }
    alignSelectedVersions();
    status.value = "loaded";
  } catch (reason) { error.value = reason.message; status.value = reason.code === "not-found" ? "missing" : "failed"; }
});

async function persistActiveEditingSession({ refresh = true } = {}) {
  const saved = await cvWorkspace.saveEditingSession({
    ...activeSession.value,
    ...draft,
    id: activeSession.value.id,
    cvId: draft.id,
    optimisticVersion: activeSession.value.optimisticVersion,
  });
  activateEditingSession(saved, activeBaseRevisionNumber.value);
  if (refresh) await refreshEditingContext();
  return saved;
}

async function save() {
  saving.value = true;
  error.value = "";
  notice.value = "";
  try {
    if (activeSession.value) {
      const saved = await persistActiveEditingSession();
      notice.value = "Editing Session saved.";
      return saved;
    }
    const saved = await cvWorkspace.save(draft);
    replaceDraft(saved);
    if (!route.params.cvId) await router.replace(`/app/cvs/${saved.id}`);
    return saved;
  } catch(reason) {
    error.value=reason.message;
    return null;
  } finally {
    saving.value=false;
  }
}
async function resolveFinishedSession(sessionId, originalError) {
  const session = await cvWorkspace.resumeEditingSession(sessionId);
  if (session.status !== "finished") throw originalError;
  return session;
}

async function finishEditingSession() {
  if (!activeSession.value || saving.value) return;
  saving.value = true;
  error.value = "";
  notice.value = "";
  const sessionId = activeSession.value.id;
  try {
    let saved;
    try {
      saved = await persistActiveEditingSession({ refresh: false });
    } catch (reason) {
      if (reason.code !== "session-finished") throw reason;
      const finished = await resolveFinishedSession(sessionId, reason);
      activeSession.value = null;
      await refreshEditingContext();
      notice.value = `Editing Session finished as Revision ${finished.revisionNumber}.`;
      return;
    }

    let finished;
    try {
      finished = await cvWorkspace.finishEditingSession(
        saved.id,
        saved.optimisticVersion,
      );
    } catch (reason) {
      finished = await resolveFinishedSession(sessionId, reason);
    }
    activeSession.value = null;
    await refreshEditingContext();
    notice.value = `Editing Session finished as Revision ${finished.revisionNumber}.`;
  } catch (reason) {
    error.value = reason.message;
  } finally {
    saving.value = false;
  }
}

async function proposeEditingSessionChange() {
  if (!activeSession.value || proposingChange.value) return;
  proposingChange.value = true;
  error.value = "";
  notice.value = "";
  try {
    sessionChangeProposal.value = await cvWorkspace.proposeEditingSessionChange({
      sessionId: activeSession.value.id,
      baseOptimisticVersion: activeSession.value.optimisticVersion,
      operations: [{
        type: "replace_working_state",
        value: {
          ...activeSession.value,
          ...draft,
          id: activeSession.value.id,
          cvId: draft.id,
        },
      }],
    });
  } catch (reason) {
    error.value = reason.message;
  } finally {
    proposingChange.value = false;
  }
}

async function applySessionChangeProposal() {
  if (!sessionChangeProposal.value || saving.value) return;
  saving.value = true;
  error.value = "";
  notice.value = "";
  const proposalId = sessionChangeProposal.value.id;
  try {
    const applied = await cvWorkspace.applyChangeProposal(proposalId);
    const session = await cvWorkspace.resumeEditingSession(
      applied.result.editingSessionId,
    );
    activateEditingSession(session, activeBaseRevisionNumber.value);
    sessionChangeProposal.value = null;
    await refreshEditingContext();
    notice.value = "Change Proposal applied to the Editing Session.";
  } catch (reason) {
    if (reason.code === "stale-proposal" && activeSession.value) {
      const refreshed = await cvWorkspace.resumeEditingSession(activeSession.value.id);
      activateEditingSession(refreshed, activeBaseRevisionNumber.value);
      await refreshEditingContext();
    }
    error.value = reason.message;
  } finally {
    saving.value = false;
  }
}

async function discardSessionChangeProposal() {
  if (!sessionChangeProposal.value || saving.value) return;
  saving.value = true;
  error.value = "";
  try {
    await cvWorkspace.discardChangeProposal(sessionChangeProposal.value.id);
    sessionChangeProposal.value = null;
    notice.value = "Change Proposal discarded. The Editing Session was not changed.";
  } catch (reason) {
    error.value = reason.message;
  } finally {
    saving.value = false;
  }
}
async function publish() { try { if (!draft.id) await save(); const saved=await cvWorkspace.publish(draft.id,publishSlug.value); replaceDraft(saved); publishSlug.value=saved.slug; } catch(reason){error.value=reason.message;} }
async function unpublish() { try { replaceDraft(await cvWorkspace.unpublish(draft.id)); } catch(reason){error.value=reason.message;} }
async function generateSummary() {
  error.value = "";
  generatingSummary.value = true;
  try {
    proposal.value = await cvWorkspace.suggestSummary(draft, instruction.value);
  } catch (reason) {
    error.value = reason.message;
  } finally {
    generatingSummary.value = false;
  }
}
async function createReviewedTasks(tasks) {
  error.value = "";
  try {
    const selections = await createTaskBlocks({ blockLibrary, tasks });
    let nextDraft = draft;
    for (const selection of selections) nextDraft = addSelection(nextDraft, selection);
    replaceDraft(nextDraft);
    const catalog = await blockLibrary.browse();
    blocks.value = catalog.blocks;
    alignSelectedVersions();
  } catch (reason) {
    error.value = reason.message;
    throw reason;
  }
}

function generateTaskProposal(instruction) {
  return openRouter.generateTasks({ instruction });
}
</script>

<template>
  <p v-if="status === 'loading'" aria-busy="true">Loading CV workspace…</p>
  <section v-else-if="status === 'missing'"><h2>CV not found</h2><NuxtLink to="/app/cvs">Return to saved CVs</NuxtLink></section>
  <div v-else-if="status === 'failed'" role="alert">{{ error }}</div>
  <div v-else class="editor-layout">
    <section class="editor-controls">
      <div v-if="error" role="alert">{{ error }}</div>
      <p v-if="notice" role="status">{{ notice }}</p>
      <section v-if="draft.id" aria-labelledby="editing-sessions-heading">
        <h2 id="editing-sessions-heading">Open Editing Sessions</h2>
        <p v-if="!openEditingSessions.length">No open Editing Sessions.</p>
        <article v-for="session in openEditingSessions" :key="session.id" class="session-row">
          <span>Editing Session based on Revision {{ session.baseRevisionNumber }} · working version {{ session.optimisticVersion }}</span>
          <button class="secondary control-compact" @click="resumeEditingSession(session)">Resume Editing Session</button>
        </article>
        <p v-if="activeSession"><strong>Editing Session based on Revision {{ activeBaseRevisionNumber }}</strong> · working version {{ activeSession.optimisticVersion }}</p>
      </section>
      <label>CV name<input v-model="draft.name" placeholder="Product lead CV" /></label>
      <div class="grid"><label>Name<input v-model="draft.profile.basics.name" /></label><label>Target role<input v-model="draft.profile.basics.label" /></label></div>
      <label>Email<input v-model="draft.profile.basics.email" type="email" /></label>
      <label>Theme<select v-model="draft.themeId"><option :value="null">Default — Editorial</option><option v-for="theme in themes" :key="theme.id" :value="theme.id">{{ theme.name }} — {{ theme.description }}</option></select></label>
      <details><summary>Summary generator</summary><label>Direction<input v-model="instruction" placeholder="Focus on product leadership" /></label><button class="secondary control-standard" :aria-busy="generatingSummary" :disabled="generatingSummary" @click="generateSummary">Generate Summary Change Proposal</button><article v-if="proposal"><label>Edit Summary Change Proposal<textarea v-model="proposal.text" aria-label="Edit Summary Change Proposal"></textarea></label><div class="grid"><button class="control-standard" @click="replaceDraft(cvWorkspace.acceptSummary(draft, proposal)); proposal=null">Apply Change Proposal</button><button class="secondary control-standard" @click="proposal=null">Discard</button></div></article></details>

      <TaskChat
        :generate-tasks-handler="generateTaskProposal"
        :create-tasks-handler="createReviewedTasks"
      />

      <h2>CV Block Library</h2>
      <p v-if="!blocks.length">No CV Blocks available. <NuxtLink to="/app/blocks">Create CV Blocks first.</NuxtLink></p>
      <article v-for="block in blocks" :key="block.id" class="library-row"><div><small>{{ block.kind }}</small><strong>{{ block.title }}</strong><select v-model="selectedVersions[block.id]" aria-label="Block Version"><option v-for="version in [...block.versions].reverse()" :key="version.id" :value="version.id">Block Version {{ version.number }} · {{ version.source.type }}</option></select></div><button v-if="!selectedForBlock(block.id)" class="secondary control-compact" @click="add(block)">Add Block Version</button><button v-else class="secondary control-compact" :disabled="selectedForBlock(block.id).versionId === selectedVersions[block.id]" @click="replaceVersion(block)">Replace Block Version</button></article>

      <h2>Selected Block Versions</h2>
      <section class="section-list experience-composition"><h3>experience</h3><p v-if="!selectedExperienceGroups.length"><small>No selected Block Versions.</small></p><section v-for="employer in selectedExperienceGroups" :key="employer.employerId" class="selection-employer"><h4>{{ employer.employer }}</h4><div v-for="occasion in employer.occasions" :key="occasion.occasionId"><h5>{{ occasion.role }} · {{ formatEmploymentPeriod(occasion.startDate, occasion.endDate) }}</h5><article v-for="item in occasion.items" :key="item.versionId" class="selection"><span>{{ item.block?.title || item.content?.text }} · Block Version {{ selectionVersionNumber(item) }}</span><div><select :value="item.section" aria-label="CV section" @change="changeSection(item,$event.target.value)"><option v-for="target in ['experience','skills','certifications','education','interests']" :key="target">{{ target }}</option></select><button class="outline control-compact" :disabled="item.order === 0" @click="shift(item,-1)">↑</button><button class="outline control-compact" :disabled="item.order === selectedBySection.experience.length - 1" @click="shift(item,1)">↓</button><button class="secondary control-compact" @click="remove(item.versionId)">Remove</button></div></article></div></section></section>
      <section v-for="section in ['skills','certifications','education','interests']" :key="section" class="section-list"><h3>{{ section }}</h3><p v-if="!selectedBySection[section]?.length"><small>No selected Block Versions.</small></p><article v-for="item in selectedBySection[section]" :key="item.versionId" class="selection"><span>{{ item.block?.title || item.content?.text || item.content?.name }} · Block Version {{ selectionVersionNumber(item) }}</span><div><select :value="item.section" aria-label="CV section" @change="changeSection(item,$event.target.value)"><option v-for="target in ['experience','skills','certifications','education','interests']" :key="target">{{ target }}</option></select><button class="outline control-compact" :disabled="item.order === 0" @click="shift(item,-1)">↑</button><button class="outline control-compact" :disabled="item.order === selectedBySection[section].length - 1" @click="shift(item,1)">↓</button><button class="secondary control-compact" @click="remove(item.versionId)">Remove</button></div></article></section>
      <button v-if="draft.selections.length" class="secondary control-standard" @click="clearDraft">Clear selected Block Versions…</button>
      <button class="control-standard" :aria-busy="saving" :disabled="saving" @click="save">{{ activeSession ? "Save Editing Session" : "Save CV" }}</button>
      <button v-if="activeSession" class="secondary control-standard" :aria-busy="proposingChange" :disabled="saving || proposingChange" @click="proposeEditingSessionChange">Review Change Proposal</button>
      <button v-if="activeSession" class="secondary control-standard" :disabled="saving" @click="finishEditingSession">Finish as CV Revision</button>
      <article v-if="sessionChangeProposal" aria-label="Editing Session Change Proposal" class="proposal-review">
        <h3>Editing Session Change Proposal</h3>
        <p>Target {{ sessionChangeProposal.target?.id || activeSession?.id }} · Editing Session working version {{ sessionChangeProposal.baseOptimisticVersion }}</p>
        <p>Expires {{ sessionChangeProposal.expiresAt }}</p>
        <h4>Structured diff</h4>
        <ul>
          <li v-for="field in sessionChangeProposal.diff?.fields || []" :key="field.path">
            {{ field.path }}: {{ field.before }} → {{ field.after }}
          </li>
          <li>Added Block Versions: {{ sessionChangeProposal.diff?.composition?.added?.length || 0 }}</li>
          <li>Removed Block Versions: {{ sessionChangeProposal.diff?.composition?.removed?.length || 0 }}</li>
        </ul>
        <pre>{{ JSON.stringify(sessionChangeProposal.diff, null, 2) }}</pre>
        <p v-if="sessionChangeProposal.warnings?.length">Warnings: {{ sessionChangeProposal.warnings.join(" · ") }}</p>
        <p v-else>No warnings.</p>
        <div class="grid">
          <button class="control-standard" :disabled="saving" @click="applySessionChangeProposal">Apply Proposed Changes</button>
          <button class="secondary control-standard" :disabled="saving" @click="discardSessionChangeProposal">Discard Change Proposal</button>
        </div>
      </article>
      <NuxtLink v-if="draft.id" role="button" class="secondary control-standard" :to="`/app/cvs/${draft.id}/preview`">Private preview</NuxtLink>
      <details v-if="draft.id"><summary>Publishing</summary><label>Public slug<input v-model="publishSlug" placeholder="product-lead" /></label><button v-if="draft.status !== 'published'" @click="publish">Publish unlisted link</button><template v-else><p><NuxtLink :to="`/cv/${draft.slug}`" target="_blank">Open /cv/{{ draft.slug }}</NuxtLink></p><button class="secondary" @click="unpublish">Unpublish</button></template></details>
      <section v-if="draft.id" aria-labelledby="revision-history-heading">
        <h2 id="revision-history-heading">Revision history</h2>
        <p v-if="!revisions.length">No immutable CV Revisions yet. <button class="secondary control-compact" @click="startEditingSession(null)">Start first Editing Session</button></p>
        <ol v-else>
          <li v-for="revision in revisions" :key="revision.id">
            <strong>Revision {{ revision.number }}</strong>
            <span v-if="revision.baseRevisionNumber"> · based on Revision {{ revision.baseRevisionNumber }}</span>
            <button class="secondary control-compact" @click="startEditingSession(revision)">Start from Revision {{ revision.number }}</button>
          </li>
        </ol>
      </section>
    </section>
    <aside class="live-preview"><p><strong>Live preview</strong></p><CvDocument :document="draft" /></aside>
  </div>
</template>

<style scoped>.editor-layout{display:grid;grid-template-columns:minmax(22rem,.8fr) minmax(36rem,1.2fr);gap:2rem;align-items:start}.editor-controls{min-width:0}.live-preview{position:sticky;top:1rem;transform-origin:top left}.library-row,.selection,.session-row{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:.7rem;margin:.5rem 0;border:1px solid #dce3df;box-shadow:none}.library-row strong{display:block}.selection button{width:auto;margin:0 .15rem}.selection select{display:inline-block;width:auto;margin:0 .3rem}.section-list{margin:1.2rem 0}.selection-employer{margin:.75rem 0 1.25rem;padding-left:.75rem;border-left:3px solid #37624e}.selection-employer h4{margin:0 0 .6rem}.selection-employer h5{margin:.7rem 0 .35rem;color:#52635b}@media(max-width:1100px){.editor-layout{grid-template-columns:1fr}.live-preview{position:static}}@media print{.editor-controls{display:none}.editor-layout{display:block}}</style>
