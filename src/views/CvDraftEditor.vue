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
const copyRoleName = ref("");
const selectedVersions = reactive({});
function normalizeEditorDraft(input) {
  const normalized = normalizeDraft(input);
  return {
    ...normalized,
    profile: {
      ...normalized.profile,
      basics: normalized.profile?.basics || {},
    },
  };
}
const draft = reactive(normalizeEditorDraft({ name: "", profile: { basics: {} }, selections: [] }));
const themes = listThemes();

function replaceDraft(next) { Object.assign(draft, normalizeEditorDraft(next)); }
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
const archivedEditingSessions = computed(() => editingSessions.value.filter((item) => item.status === "archived"));
const activeBaseRevisionNumber = computed(() => activeSession.value?.baseRevisionNumber || revisions.value.find((item) => item.id === activeSession.value?.baseRevisionId)?.number || null);
const publishedRevisionNumber = computed(() => revisions.value.find((item) => item.id === draft.publishedRevisionId)?.number || null);
function editingSessionLabel(session) {
  return session.baseRevisionNumber
    ? `Editing Session based on Revision ${session.baseRevisionNumber}`
    : "Initial Editing Session";
}

function activateEditingSession(session, baseRevisionNumber = null) {
  const publication = {
    slug: draft.slug,
    status: draft.status,
    publishedAt: draft.publishedAt,
    publishedRevisionId: draft.publishedRevisionId,
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
    sessionChangeProposal.value = await cvWorkspace.proposeLifecycleChange({ operation: {
      type: "start_editing_session",
      target: { type: "cv", id: draft.id },
      baseRevisionId: revision?.id || null,
    } });
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
    if (draft.id) throw new Error("Resume or start an Editing Session before changing this CV.");
    const session = await cvWorkspace.createCvEditingSession(normalizeDraft(draft));
    replaceDraft({ ...draft, id: session.cvId });
    activateEditingSession(session);
    await refreshEditingContext();
    await router.replace(`/app/cvs/${session.cvId}`);
    notice.value = "CV and initial Editing Session created.";
    return session;
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

    sessionChangeProposal.value = await cvWorkspace.proposeLifecycleChange({ operation: {
      type: "finish_editing_session",
      target: { type: "editing_session", id: saved.id },
      baseOptimisticVersion: saved.optimisticVersion,
    } });
    notice.value = "Review the finish proposal, then apply it to create the immutable CV Revision.";
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

async function proposeLifecycleChange(operation) {
  if (proposingChange.value) return;
  proposingChange.value = true;
  error.value = "";
  notice.value = "";
  try {
    sessionChangeProposal.value = await cvWorkspace.proposeLifecycleChange({ operation });
  } catch (reason) {
    error.value = reason.message;
  } finally {
    proposingChange.value = false;
  }
}

function copyFrom(source, intent) {
  const operation = {
    type: intent,
    source: {
      type: source.status ? "editing_session" : "cv_revision",
      id: source.id,
      ...(!source.status && source.cvId ? { cvId: source.cvId } : {}),
    },
    ...(source.status ? { baseOptimisticVersion: source.optimisticVersion } : {}),
    ...(intent === "copy_for_new_role" ? { name: copyRoleName.value } : {}),
  };
  return proposeLifecycleChange(operation);
}

function proposeSessionLifecycle(session, type) {
  return proposeLifecycleChange({
    type,
    target: { type: "editing_session", id: session.id },
    baseOptimisticVersion: session.optimisticVersion,
  });
}

async function applySessionChangeProposal() {
  if (!sessionChangeProposal.value || saving.value) return;
  saving.value = true;
  error.value = "";
  notice.value = "";
  const proposalId = sessionChangeProposal.value.id;
  const operationType = sessionChangeProposal.value.operationType || "replace_working_state";
  try {
    const applied = await cvWorkspace.applyChangeProposal(proposalId);
    if (["edit_content", "replace_working_state", "start_editing_session", "resume_editing_session", "copy_to_new_version", "copy_for_new_role", "restore_editing_session"].includes(operationType)) {
      const session = await cvWorkspace.resumeEditingSession(applied.result.editingSessionId);
      activateEditingSession(session, activeBaseRevisionNumber.value);
      if (operationType === "copy_for_new_role") await router.replace(`/app/cvs/${applied.result.cvId}`);
    } else if (["archive_editing_session", "finish_editing_session"].includes(operationType)) {
      activeSession.value = null;
    } else if (["archive_cv", "restore_cv"].includes(operationType)) {
      replaceDraft(await cvWorkspace.open(applied.result.cvId));
      if (operationType === "archive_cv") activeSession.value = null;
    } else if (["publish_revision", "withdraw_publication"].includes(operationType)) {
      replaceDraft(await cvWorkspace.open(applied.result.cvId));
      publishSlug.value = draft.slug || publishSlug.value;
    }
    sessionChangeProposal.value = null;
    await refreshEditingContext();
    notice.value = operationType === "finish_editing_session"
      ? `Editing Session finished as Revision ${applied.result.revisionNumber}.`
      : "Change Proposal applied.";
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
function proposeRevisionPublication(revision) {
  return proposeLifecycleChange({
    type: "publish_revision",
    target: { type: "cv_revision", id: revision.id, cvId: draft.id },
    slug: publishSlug.value,
  });
}
function publicationLabel(revision) {
  if (draft.status === "published" && revision.id === draft.publishedRevisionId) return "Published Revision";
  if (draft.status === "published" && publishedRevisionNumber.value && revision.number < publishedRevisionNumber.value) {
    return `Roll back to Revision ${revision.number}`;
  }
  return `Publish Revision ${revision.number}`;
}
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
          <span>{{ editingSessionLabel(session) }} · working version {{ session.optimisticVersion }}</span>
          <button v-if="draft.status !== 'archived'" class="secondary control-compact" @click="resumeEditingSession(session)">Resume Editing Session</button>
        </article>
        <template v-if="archivedEditingSessions.length">
          <h3>Archived Editing Sessions</h3>
          <article v-for="session in archivedEditingSessions" :key="session.id" class="session-row">
            <span>Archived Editing Session · working version {{ session.optimisticVersion }}</span>
            <button v-if="draft.status !== 'archived'" class="secondary control-compact" @click="proposeSessionLifecycle(session, 'restore_editing_session')">Restore Editing Session</button>
          </article>
        </template>
        <p v-if="activeSession"><strong>{{ editingSessionLabel({ baseRevisionNumber: activeBaseRevisionNumber }) }}</strong> · working version {{ activeSession.optimisticVersion }}</p>
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
      <button v-if="draft.status !== 'archived' && draft.selections.length" class="secondary control-standard" @click="clearDraft">Clear selected Block Versions…</button>
      <button v-if="draft.status !== 'archived' && (activeSession || !draft.id)" class="control-standard" :aria-busy="saving" :disabled="saving" @click="save">{{ activeSession ? "Save Editing Session" : "Create CV Editing Session" }}</button>
      <button v-if="activeSession" class="secondary control-standard" :aria-busy="proposingChange" :disabled="saving || proposingChange" @click="proposeEditingSessionChange">Review Change Proposal</button>
      <button v-if="activeSession" class="secondary control-standard" :disabled="saving" @click="finishEditingSession">Finish as CV Revision</button>
      <label v-if="draft.id">New role-focused CV name<input v-model="copyRoleName" placeholder="Head of Marketing at Facebook" /></label>
      <template v-if="activeSession && draft.status !== 'archived'">
        <button class="secondary control-standard" :disabled="saving || proposingChange" @click="copyFrom(activeSession, 'copy_to_new_version')">Copy to New Version</button>
        <button class="secondary control-standard" :disabled="saving || proposingChange || !copyRoleName.trim()" @click="copyFrom(activeSession, 'copy_for_new_role')">Copy for New Role</button>
        <button class="secondary control-standard" :disabled="saving || proposingChange" @click="proposeSessionLifecycle(activeSession, 'archive_editing_session')">Archive Editing Session</button>
      </template>
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
      <button v-if="draft.id && draft.status !== 'archived'" class="secondary control-standard" @click="proposeLifecycleChange({ type: 'archive_cv', target: { type: 'cv', id: draft.id } })">Archive CV</button>
      <button v-else-if="draft.id" class="secondary control-standard" @click="proposeLifecycleChange({ type: 'restore_cv', target: { type: 'cv', id: draft.id } })">Restore CV</button>
      <details v-if="draft.id && draft.status !== 'archived'"><summary>Publishing</summary><label>Stable public slug<input v-model="publishSlug" :disabled="Boolean(draft.slug)" placeholder="product-lead" /></label><p>Select an exact immutable Revision below, review its Change Proposal, then apply.</p><template v-if="draft.status === 'published'"><p><NuxtLink :to="`/cv/${draft.slug}`" target="_blank">Open /cv/{{ draft.slug }}</NuxtLink></p><button class="secondary" @click="proposeLifecycleChange({ type: 'withdraw_publication', target: { type: 'cv', id: draft.id } })">Withdraw publication</button></template></details>
      <section v-if="draft.id" aria-labelledby="revision-history-heading">
        <h2 id="revision-history-heading">Revision history</h2>
        <p v-if="!revisions.length">No immutable CV Revisions yet. <button v-if="draft.status !== 'archived' && !openEditingSessions.length" class="secondary control-compact" @click="startEditingSession(null)">Start first Editing Session</button></p>
        <ol v-else>
          <li v-for="revision in revisions" :key="revision.id">
            <strong>Revision {{ revision.number }}</strong>
            <span v-if="revision.baseRevisionNumber"> · based on Revision {{ revision.baseRevisionNumber }}</span>
            <button v-if="draft.status !== 'archived'" class="secondary control-compact" @click="startEditingSession(revision)">Start from Revision {{ revision.number }}</button>
            <button v-if="draft.status !== 'archived'" class="secondary control-compact" @click="copyFrom(revision, 'copy_to_new_version')">Copy to New Version</button>
            <button class="secondary control-compact" :disabled="!copyRoleName.trim()" @click="copyFrom(revision, 'copy_for_new_role')">Copy for New Role</button>
            <button v-if="draft.status !== 'archived'" class="secondary control-compact" :disabled="(draft.status === 'published' && revision.id === draft.publishedRevisionId) || !publishSlug.trim()" @click="proposeRevisionPublication(revision)">{{ publicationLabel(revision) }}</button>
          </li>
        </ol>
      </section>
    </section>
    <aside class="live-preview"><p><strong>Live preview</strong></p><CvDocument :document="draft" /></aside>
  </div>
</template>

<style scoped>
.editor-layout { display: grid; grid-template-columns: minmax(23rem, .9fr) minmax(34rem, 1.1fr); gap: clamp(1.5rem, 3vw, 3rem); align-items: start; }
.editor-controls { min-width: 0; }
.editor-controls > h2, .editor-controls > section > h2 { margin-top: 2.5rem; padding-bottom: .55rem; border-bottom: 2px solid var(--ink); font-size: 1.8rem; font-weight: 400; }
.live-preview { position: sticky; top: 1rem; transform-origin: top left; }
.live-preview > p { margin: 0 0 .65rem; font-family: var(--font-label); font-size: .68rem; letter-spacing: .1em; text-transform: uppercase; }
.library-row, .selection, .session-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: .85rem !important; margin: .6rem 0 !important; border: 1px solid var(--ink) !important; background: var(--paper-light); box-shadow: 3px 3px 0 var(--paper-deep); }
.library-row strong { display: block; font-family: var(--font-editorial); font-size: 1.05rem; }
.selection button { width: auto; margin: 0 .15rem; }
.selection select { display: inline-block; width: auto !important; margin: 0 .3rem !important; }
.section-list { margin: 1.5rem 0; }
.section-list > h3 { font-family: var(--font-label); font-size: .72rem; letter-spacing: .1em; text-transform: uppercase; }
.selection-employer { margin: .75rem 0 1.25rem; padding-left: .9rem; border-left: 4px solid var(--marker); }
.selection-employer h4 { margin: 0 0 .6rem; }
.selection-employer h5 { margin: .7rem 0 .35rem; color: var(--muted); font-family: var(--font-label); font-size: .72rem; }
.proposal-review { margin: 1.5rem 0 !important; border: 2px solid var(--ink) !important; box-shadow: 6px 6px 0 var(--marker) !important; }
.proposal-review pre { max-height: 22rem; overflow: auto; padding: 1rem; background: var(--ink); color: var(--paper-light); font-family: var(--font-label); font-size: .7rem; }
@media (max-width: 1180px) { .editor-layout { grid-template-columns: 1fr; } .live-preview { position: static; } }
@media (max-width: 650px) { .library-row, .selection, .session-row { align-items: stretch; flex-direction: column; } .selection select { width: 100% !important; margin: .4rem 0 !important; } }
@media print { .editor-controls { display: none; } .editor-layout { display: block; } }
</style>
