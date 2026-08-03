<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import CvDocument from "../components/CvDocument.vue";
import TaskChat from "../components/TaskChat.vue";
import { BLOCK_KINDS } from "../domain/blocks/blockLibrary";
import { addSelection, groupExperienceSelections, moveSelection, normalizeDraft, removeSelection } from "../domain/cvs/cvDraft";
import { formatEmploymentPeriod, normalizeEmploymentGroup } from "../domain/employment/occasion";
import { createTaskBlocks } from "../domain/tasks/createTaskBlocks";
import { listThemes } from "../domain/themes/themeRegistry";
import { blockLibrary } from "../services/blockLibrary";
import { cvProfileDefaults } from "../services/cvProfileDefaults";
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
const blockKindFilter = ref("all");
const selectedJobIds = ref([]);
const pendingRequest = ref("");
const cvDetailsOpen = ref(false);
const sessionProposalOpen = ref(false);
const savingCvDetails = ref(false);
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
const cvDetails = reactive({
  name: "",
  personName: "",
  targetRole: "",
  email: "",
});
const themes = listThemes();
const defaultThemeValue = "__default_editorial__";
const themeItems = [
  { label: "Default — Editorial", value: defaultThemeValue },
  ...themes.map((theme) => ({
    label: `${theme.name} — ${theme.description}`,
    value: theme.id,
  })),
];
const compositionSectionItems = ["experience", "skills", "certifications", "education", "interests"];
const blockKindItems = computed(() => [
  { label: "All", value: "all" },
  ...BLOCK_KINDS.map((kind) => ({
    label: `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`,
    value: kind,
  })),
]);
const jobFilterItems = computed(() => {
  const jobs = new Map();
  for (const block of blocks.value) {
    if (block.kind !== "experience") continue;
    const employment = employmentForBlock(block);
    if (!jobs.has(employment.occasionId)) {
      jobs.set(employment.occasionId, {
        label: `${employment.role} at ${employment.employer} · ${formatEmploymentPeriod(employment.startDate, employment.endDate)}`,
        value: employment.occasionId,
      });
    }
  }
  return [...jobs.values()].sort((left, right) => left.label.localeCompare(right.label));
});
const filteredBlocks = computed(() => blocks.value.filter((block) => {
  if (blockKindFilter.value !== "all" && block.kind !== blockKindFilter.value) return false;
  if (!selectedJobIds.value.length) return true;
  if (block.kind !== "experience") return false;
  return selectedJobIds.value.includes(employmentForBlock(block).occasionId);
}));
const selectedTheme = computed({
  get: () => draft.themeId || defaultThemeValue,
  set: (value) => { draft.themeId = value === defaultThemeValue ? null : value; },
});

function plainSnapshot(value) {
  return JSON.parse(JSON.stringify(value));
}
function replaceDraft(next) { Object.assign(draft, normalizeEditorDraft(next)); }
function openCvDetails() {
  Object.assign(cvDetails, {
    name: draft.name || "",
    personName: draft.profile.basics.name || "",
    targetRole: draft.profile.basics.label || "",
    email: draft.profile.basics.email || "",
  });
  cvDetailsOpen.value = true;
}
async function saveCvDetails() {
  if (savingCvDetails.value) return;
  savingCvDetails.value = true;
  error.value = "";
  try {
    draft.name = cvDetails.name.trim();
    draft.profile.basics = {
      ...draft.profile.basics,
      name: cvDetails.personName.trim(),
      label: cvDetails.targetRole.trim(),
      email: cvDetails.email.trim(),
    };
    const savedDefaults = await cvProfileDefaults.save({
      name: draft.profile.basics.name,
      email: draft.profile.basics.email,
    });
    cvDetailsOpen.value = false;
    notice.value = savedDefaults.scope === "developer"
      ? "CV details updated. Developer defaults saved locally."
      : "CV details updated and account defaults saved.";
  } catch (reason) {
    error.value = reason.message;
  } finally {
    savingCvDetails.value = false;
  }
}
function showSessionProposal(nextProposal) {
  sessionChangeProposal.value = nextProposal;
  sessionProposalOpen.value = true;
}
function sectionFor(kind) { return { experience:"experience", skill:"skills", certification:"certifications", education:"education", interest:"interests" }[kind]; }
function selectedVersion(block) { return block.versions.find((item)=>item.id===(selectedVersions[block.id]||block.currentVersion.id))||block.currentVersion; }
function blockVersionItems(block) {
  return [...block.versions].reverse().map((version) => ({
    label: `Block Version ${version.number} · ${version.source.type}`,
    value: version.id,
  }));
}
function employmentForBlock(block) {
  const employmentContext = block.contexts?.find((context) => context.type === "employment");
  return normalizeEmploymentGroup(employmentContext?.metadata);
}
function experienceParentJob(block) {
  if (block.kind !== "experience") return "";
  const employment = employmentForBlock(block);
  return `${employment.role} at ${employment.employer}`;
}
function requestIs(key) {
  return pendingRequest.value === key;
}
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
  const requestKey = `start-session:${revision?.id || "initial"}`;
  if (pendingRequest.value) return;
  pendingRequest.value = requestKey;
  error.value = "";
  notice.value = "";
  try {
    showSessionProposal(await cvWorkspace.proposeLifecycleChange({ operation: {
      type: "start_editing_session",
      target: { type: "cv", id: draft.id },
      baseRevisionId: revision?.id || null,
    } }));
  } catch (reason) {
    error.value = reason.message;
  } finally {
    pendingRequest.value = "";
  }
}

async function resumeEditingSession(summary) {
  const requestKey = `resume-session:${summary.id}`;
  if (pendingRequest.value) return;
  pendingRequest.value = requestKey;
  error.value = "";
  notice.value = "";
  try {
    const session = await cvWorkspace.resumeEditingSession(summary.id);
    sessionChangeProposal.value = null;
    sessionProposalOpen.value = false;
    activateEditingSession(session, summary.baseRevisionNumber);
  } catch (reason) {
    error.value = reason.message;
  } finally {
    pendingRequest.value = "";
  }
}

onMounted(async () => {
  try {
    const [catalog, existing, history, sessions, profileDefaults] = await Promise.all([
      blockLibrary.browse(),
      route.params.cvId ? cvWorkspace.open(route.params.cvId) : Promise.resolve(null),
      route.params.cvId ? cvWorkspace.history(route.params.cvId) : Promise.resolve([]),
      route.params.cvId ? cvWorkspace.editingSessions(route.params.cvId) : Promise.resolve([]),
      cvProfileDefaults.load().catch(() => null),
    ]);
    blocks.value = catalog.blocks;
    revisions.value = history;
    editingSessions.value = sessions;
    if (existing) {
      replaceDraft(existing);
      publishSlug.value = existing.slug || "";
    } else if (profileDefaults) {
      draft.profile.basics.name ||= profileDefaults.name;
      draft.profile.basics.email ||= profileDefaults.email;
    }
    alignSelectedVersions();
    status.value = "loaded";
  } catch (reason) { error.value = reason.message; status.value = reason.code === "not-found" ? "missing" : "failed"; }
});

async function persistActiveEditingSession({ refresh = true } = {}) {
  const sessionSnapshot = plainSnapshot(activeSession.value);
  const draftSnapshot = plainSnapshot(draft);
  const saved = await cvWorkspace.saveEditingSession({
    ...sessionSnapshot,
    ...draftSnapshot,
    id: activeSession.value.id,
    cvId: draft.id,
    optimisticVersion: activeSession.value.optimisticVersion,
  });
  activateEditingSession(saved, activeBaseRevisionNumber.value);
  if (refresh) await refreshEditingContext();
  return saved;
}

async function save() {
  if (pendingRequest.value) return null;
  pendingRequest.value = "save-session";
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
    const session = await cvWorkspace.createCvEditingSession(normalizeDraft(plainSnapshot(draft)));
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
    pendingRequest.value = "";
  }
}
async function resolveFinishedSession(sessionId, originalError) {
  const session = await cvWorkspace.resumeEditingSession(sessionId);
  if (session.status !== "finished") throw originalError;
  return session;
}

async function finishEditingSession() {
  if (!activeSession.value || saving.value || pendingRequest.value) return;
  pendingRequest.value = "finish-session";
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

    showSessionProposal(await cvWorkspace.proposeLifecycleChange({ operation: {
      type: "finish_editing_session",
      target: { type: "editing_session", id: saved.id },
      baseOptimisticVersion: saved.optimisticVersion,
    } }));
    notice.value = "Review the finish proposal, then apply it to create the immutable CV Revision.";
  } catch (reason) {
    error.value = reason.message;
  } finally {
    saving.value = false;
    pendingRequest.value = "";
  }
}

async function proposeEditingSessionChange() {
  if (!activeSession.value || proposingChange.value || pendingRequest.value) return;
  pendingRequest.value = "review-session-change";
  proposingChange.value = true;
  error.value = "";
  notice.value = "";
  try {
    showSessionProposal(await cvWorkspace.proposeEditingSessionChange({
      sessionId: activeSession.value.id,
      baseOptimisticVersion: activeSession.value.optimisticVersion,
      operations: [{
        type: "replace_working_state",
        value: {
          ...plainSnapshot(activeSession.value),
          ...plainSnapshot(draft),
          id: activeSession.value.id,
          cvId: draft.id,
        },
      }],
    }));
  } catch (reason) {
    error.value = reason.message;
  } finally {
    proposingChange.value = false;
    pendingRequest.value = "";
  }
}

async function proposeLifecycleChange(operation) {
  if (proposingChange.value || pendingRequest.value) return;
  const requestKey = `lifecycle:${operation.type}:${operation.target?.id || operation.source?.id || ""}`;
  pendingRequest.value = requestKey;
  proposingChange.value = true;
  error.value = "";
  notice.value = "";
  try {
    showSessionProposal(await cvWorkspace.proposeLifecycleChange({ operation }));
  } catch (reason) {
    error.value = reason.message;
  } finally {
    proposingChange.value = false;
    pendingRequest.value = "";
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
  if (!sessionChangeProposal.value || saving.value || pendingRequest.value) return;
  pendingRequest.value = "apply-proposal";
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
    sessionProposalOpen.value = false;
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
    pendingRequest.value = "";
  }
}

async function discardSessionChangeProposal() {
  if (!sessionChangeProposal.value || saving.value || pendingRequest.value) return;
  pendingRequest.value = "discard-proposal";
  saving.value = true;
  error.value = "";
  try {
    await cvWorkspace.discardChangeProposal(sessionChangeProposal.value.id);
    sessionChangeProposal.value = null;
    sessionProposalOpen.value = false;
    notice.value = "Change Proposal discarded. The Editing Session was not changed.";
  } catch (reason) {
    error.value = reason.message;
  } finally {
    saving.value = false;
    pendingRequest.value = "";
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
  if (generatingSummary.value || pendingRequest.value) return;
  pendingRequest.value = "generate-summary";
  error.value = "";
  generatingSummary.value = true;
  try {
    proposal.value = await cvWorkspace.suggestSummary(draft, instruction.value);
  } catch (reason) {
    error.value = reason.message;
  } finally {
    generatingSummary.value = false;
    pendingRequest.value = "";
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
    <section
      v-if="draft.id"
      class="editor-session-bar"
      aria-labelledby="editing-sessions-heading"
    >
      <div class="editor-session-bar-heading">
        <div>
          <p class="editor-session-eyebrow">Editing Session</p>
          <h2 id="editing-sessions-heading">
            {{ activeSession ? editingSessionLabel({ baseRevisionNumber: activeBaseRevisionNumber }) : "Open Editing Sessions" }}
          </h2>
          <p v-if="activeSession">
            working version {{ activeSession.optimisticVersion }}
          </p>
          <p v-else-if="!openEditingSessions.length">
            No open Editing Sessions.
          </p>
        </div>
        <UButton
          color="secondary"
          variant="outline"
          icon="i-lucide-file-pen-line"
          class="control-compact"
          @click="openCvDetails"
        >
          CV details
        </UButton>
      </div>
      <div v-if="!activeSession && openEditingSessions.length" class="editor-session-list">
        <article v-for="session in openEditingSessions" :key="session.id" class="session-row">
          <span>{{ editingSessionLabel(session) }} · working version {{ session.optimisticVersion }}</span>
          <UButton
            v-if="draft.status !== 'archived'"
            color="secondary"
            variant="outline"
            class="control-compact"
            :loading="requestIs(`resume-session:${session.id}`)"
            :disabled="Boolean(pendingRequest)"
            @click="resumeEditingSession(session)"
          >
            Resume Editing Session
          </UButton>
        </article>
      </div>
      <details v-if="archivedEditingSessions.length" class="editor-archived-sessions">
        <summary>Archived Editing Sessions</summary>
        <article v-for="session in archivedEditingSessions" :key="session.id" class="session-row">
          <span>Archived Editing Session · working version {{ session.optimisticVersion }}</span>
          <UButton
            v-if="draft.status !== 'archived'"
            color="secondary"
            variant="outline"
            class="control-compact"
            :loading="requestIs(`lifecycle:restore_editing_session:${session.id}`)"
            :disabled="Boolean(pendingRequest)"
            @click="proposeSessionLifecycle(session, 'restore_editing_session')"
          >
            Restore Editing Session
          </UButton>
        </article>
      </details>
    </section>
    <section class="editor-controls">
      <div v-if="error" role="alert">{{ error }}</div>
      <p v-if="notice" role="status">{{ notice }}</p>
      <div class="cv-details-summary">
        <div>
          <p class="editor-session-eyebrow">CV details</p>
          <strong>{{ draft.name || "Untitled CV" }}</strong>
          <span>{{ draft.profile.basics.name || "Add your name" }} · {{ draft.profile.basics.label || "Add a target role" }}</span>
        </div>
        <UButton
          color="secondary"
          variant="outline"
          icon="i-lucide-file-pen-line"
          class="control-compact"
          @click="openCvDetails"
        >
          {{ draft.id ? "Edit CV details" : "Add CV details" }}
        </UButton>
      </div>
      <label>Theme<USelect v-model="selectedTheme" :items="themeItems" aria-label="Theme" /></label>
      <details>
        <summary>Summary generator</summary>
        <label>Direction<UInput v-model="instruction" placeholder="Focus on product leadership" /></label>
        <UButton
          class="secondary control-standard"
          :loading="generatingSummary"
          :disabled="Boolean(pendingRequest)"
          @click="generateSummary"
        >
          Generate Summary Change Proposal
        </UButton>
        <article v-if="proposal">
          <label>Edit Summary Change Proposal<UTextarea v-model="proposal.text" aria-label="Edit Summary Change Proposal" /></label>
          <div class="grid">
            <button class="control-standard" @click="replaceDraft(cvWorkspace.acceptSummary(draft, proposal)); proposal=null">Apply Change Proposal</button>
            <button class="secondary control-standard" @click="proposal=null">Discard</button>
          </div>
        </article>
      </details>

      <TaskChat
        :generate-tasks-handler="generateTaskProposal"
        :create-tasks-handler="createReviewedTasks"
      />

      <h2>CV Block Library</h2>
      <p v-if="!blocks.length">No CV Blocks available. <NuxtLink to="/app/blocks">Create CV Blocks first.</NuxtLink></p>
      <div v-if="blocks.length" class="library-filters">
        <div
          class="block-kind-tabs"
          role="tablist"
          aria-label="Filter CV Blocks by type"
        >
          <UButton
            v-for="item in blockKindItems"
            :key="item.value"
            class="block-kind-tab"
            color="secondary"
            :variant="blockKindFilter === item.value ? 'solid' : 'outline'"
            role="tab"
            size="xs"
            :aria-selected="blockKindFilter === item.value"
            @click="blockKindFilter = item.value"
          >
            {{ item.label }}
          </UButton>
        </div>
        <div v-if="jobFilterItems.length" class="job-filter">
          <USelectMenu
            v-model="selectedJobIds"
            :items="jobFilterItems"
            value-key="value"
            label-key="label"
            multiple
            searchable
            size="sm"
            class="job-filter-select"
            color="secondary"
            variant="outline"
            icon="i-lucide-briefcase-business"
            trailing-icon="i-lucide-chevron-down"
            placeholder="All jobs"
            aria-label="Filter CV Blocks by jobs"
            :ui="{ base: 'w-full min-w-0 justify-between', leading: 'pointer-events-none', trailing: 'pointer-events-none' }"
          >
            <template #default="{ modelValue }">
              <span>{{ modelValue.length ? `${modelValue.length} job${modelValue.length === 1 ? "" : "s"} selected` : "All jobs" }}</span>
            </template>
          </USelectMenu>
          <UButton
            v-if="selectedJobIds.length"
            class="secondary control-compact job-filter-clear"
            size="xs"
            aria-label="Clear job filter"
            @click="selectedJobIds = []"
          >
            Clear
          </UButton>
        </div>
      </div>
      <p v-if="blocks.length && !filteredBlocks.length" class="empty-library-filter">
        No CV Blocks match the selected filters.
      </p>
      <article v-for="block in filteredBlocks" :key="block.id" class="library-row">
        <div class="library-row-body">
          <small>{{ block.kind }}</small>
          <strong>{{ block.title }}</strong>
          <span v-if="experienceParentJob(block)" class="library-row-context">
            {{ experienceParentJob(block) }}
          </span>
        </div>
        <footer class="library-row-footer">
          <USelect
            v-model="selectedVersions[block.id]"
            :items="blockVersionItems(block)"
            size="xs"
            class="library-version-select"
            aria-label="Block Version"
          />
          <UButton
            v-if="!selectedForBlock(block.id)"
            class="secondary control-compact"
            size="xs"
            @click="add(block)"
          >
            Add Block Version
          </UButton>
          <UButton
            v-else
            class="secondary control-compact"
            size="xs"
            :disabled="selectedForBlock(block.id).versionId === selectedVersions[block.id]"
            @click="replaceVersion(block)"
          >
            Replace Block Version
          </UButton>
        </footer>
      </article>

      <h2>Selected Block Versions</h2>
      <section class="section-list experience-composition"><h3>experience</h3><p v-if="!selectedExperienceGroups.length"><small>No selected Block Versions.</small></p><section v-for="employer in selectedExperienceGroups" :key="employer.employerId" class="selection-employer"><h4>{{ employer.employer }}</h4><div v-for="occasion in employer.occasions" :key="occasion.occasionId"><h5>{{ occasion.role }} · {{ formatEmploymentPeriod(occasion.startDate, occasion.endDate) }}</h5><article v-for="item in occasion.items" :key="item.versionId" class="selection"><span>{{ item.block?.title || item.content?.text }} · Block Version {{ selectionVersionNumber(item) }}</span><div><USelect class="selection-section" :model-value="item.section" :items="compositionSectionItems" aria-label="CV section" @update:model-value="changeSection(item, $event)" /><button class="outline control-compact" :disabled="item.order === 0" @click="shift(item,-1)">↑</button><button class="outline control-compact" :disabled="item.order === selectedBySection.experience.length - 1" @click="shift(item,1)">↓</button><button class="secondary control-compact" @click="remove(item.versionId)">Remove</button></div></article></div></section></section>
      <section v-for="section in ['skills','certifications','education','interests']" :key="section" class="section-list"><h3>{{ section }}</h3><p v-if="!selectedBySection[section]?.length"><small>No selected Block Versions.</small></p><article v-for="item in selectedBySection[section]" :key="item.versionId" class="selection"><span>{{ item.block?.title || item.content?.text || item.content?.name }} · Block Version {{ selectionVersionNumber(item) }}</span><div><USelect class="selection-section" :model-value="item.section" :items="compositionSectionItems" aria-label="CV section" @update:model-value="changeSection(item, $event)" /><button class="outline control-compact" :disabled="item.order === 0" @click="shift(item,-1)">↑</button><button class="outline control-compact" :disabled="item.order === selectedBySection[section].length - 1" @click="shift(item,1)">↓</button><button class="secondary control-compact" @click="remove(item.versionId)">Remove</button></div></article></section>
      <button v-if="draft.status !== 'archived' && draft.selections.length" class="secondary control-standard" @click="clearDraft">Clear selected Block Versions…</button>
      <UButton
        v-if="draft.status !== 'archived' && (activeSession || !draft.id)"
        class="control-standard"
        :loading="requestIs('save-session')"
        :disabled="Boolean(pendingRequest)"
        @click="save"
      >
        {{ activeSession ? "Save Editing Session" : "Create CV Editing Session" }}
      </UButton>
      <UButton
        v-if="activeSession"
        class="secondary control-standard"
        :loading="requestIs('review-session-change')"
        :disabled="Boolean(pendingRequest)"
        @click="proposeEditingSessionChange"
      >
        Review Change Proposal
      </UButton>
      <UButton
        v-if="activeSession"
        class="secondary control-standard"
        :loading="requestIs('finish-session')"
        :disabled="Boolean(pendingRequest)"
        @click="finishEditingSession"
      >
        Finish as CV Revision
      </UButton>
      <label v-if="draft.id">New role-focused CV name<UInput v-model="copyRoleName" placeholder="Head of Marketing at Facebook" /></label>
      <template v-if="activeSession && draft.status !== 'archived'">
        <UButton
          class="secondary control-standard"
          :loading="requestIs(`lifecycle:copy_to_new_version:${activeSession.id}`)"
          :disabled="Boolean(pendingRequest)"
          @click="copyFrom(activeSession, 'copy_to_new_version')"
        >
          Copy to New Version
        </UButton>
        <UButton
          class="secondary control-standard"
          :loading="requestIs(`lifecycle:copy_for_new_role:${activeSession.id}`)"
          :disabled="Boolean(pendingRequest) || !copyRoleName.trim()"
          @click="copyFrom(activeSession, 'copy_for_new_role')"
        >
          Copy for New Role
        </UButton>
        <UButton
          class="secondary control-standard"
          :loading="requestIs(`lifecycle:archive_editing_session:${activeSession.id}`)"
          :disabled="Boolean(pendingRequest)"
          @click="proposeSessionLifecycle(activeSession, 'archive_editing_session')"
        >
          Archive Editing Session
        </UButton>
      </template>
      <UButton
        v-if="sessionChangeProposal && !sessionProposalOpen"
        color="secondary"
        variant="outline"
        class="control-standard"
        @click="sessionProposalOpen = true"
      >
        Review pending Change Proposal
      </UButton>
      <NuxtLink v-if="draft.id" role="button" class="secondary control-standard" :to="`/app/cvs/${draft.id}/preview`">A4 print preview</NuxtLink>
      <UButton
        v-if="draft.id && draft.status !== 'archived'"
        class="secondary control-standard"
        :loading="requestIs(`lifecycle:archive_cv:${draft.id}`)"
        :disabled="Boolean(pendingRequest)"
        @click="proposeLifecycleChange({ type: 'archive_cv', target: { type: 'cv', id: draft.id } })"
      >
        Archive CV
      </UButton>
      <UButton
        v-else-if="draft.id"
        class="secondary control-standard"
        :loading="requestIs(`lifecycle:restore_cv:${draft.id}`)"
        :disabled="Boolean(pendingRequest)"
        @click="proposeLifecycleChange({ type: 'restore_cv', target: { type: 'cv', id: draft.id } })"
      >
        Restore CV
      </UButton>
      <details v-if="draft.id && draft.status !== 'archived'">
        <summary>Publishing</summary>
        <label>Stable public slug<UInput v-model="publishSlug" :disabled="Boolean(draft.slug)" placeholder="product-lead" /></label>
        <p>Select an exact immutable Revision below, review its Change Proposal, then apply.</p>
        <template v-if="draft.status === 'published'">
          <p><NuxtLink :to="`/cv/${draft.slug}`" target="_blank">Open /cv/{{ draft.slug }}</NuxtLink></p>
          <UButton
            class="secondary"
            :loading="requestIs(`lifecycle:withdraw_publication:${draft.id}`)"
            :disabled="Boolean(pendingRequest)"
            @click="proposeLifecycleChange({ type: 'withdraw_publication', target: { type: 'cv', id: draft.id } })"
          >
            Withdraw publication
          </UButton>
        </template>
      </details>
      <section v-if="draft.id" aria-labelledby="revision-history-heading">
        <h2 id="revision-history-heading">Revision history</h2>
        <p v-if="!revisions.length">
          No immutable CV Revisions yet.
          <UButton
            v-if="draft.status !== 'archived' && !openEditingSessions.length"
            class="secondary control-compact"
            :loading="requestIs('start-session:initial')"
            :disabled="Boolean(pendingRequest)"
            @click="startEditingSession(null)"
          >
            Start first Editing Session
          </UButton>
        </p>
        <ol v-else>
          <li v-for="revision in revisions" :key="revision.id">
            <strong>Revision {{ revision.number }}</strong>
            <span v-if="revision.baseRevisionNumber"> · based on Revision {{ revision.baseRevisionNumber }}</span>
            <UButton
              v-if="draft.status !== 'archived'"
              class="secondary control-compact"
              :loading="requestIs(`start-session:${revision.id}`)"
              :disabled="Boolean(pendingRequest)"
              @click="startEditingSession(revision)"
            >
              Start from Revision {{ revision.number }}
            </UButton>
            <UButton
              v-if="draft.status !== 'archived'"
              class="secondary control-compact"
              :loading="requestIs(`lifecycle:copy_to_new_version:${revision.id}`)"
              :disabled="Boolean(pendingRequest)"
              @click="copyFrom(revision, 'copy_to_new_version')"
            >
              Copy to New Version
            </UButton>
            <UButton
              class="secondary control-compact"
              :loading="requestIs(`lifecycle:copy_for_new_role:${revision.id}`)"
              :disabled="Boolean(pendingRequest) || !copyRoleName.trim()"
              @click="copyFrom(revision, 'copy_for_new_role')"
            >
              Copy for New Role
            </UButton>
            <UButton
              v-if="draft.status !== 'archived'"
              class="secondary control-compact"
              :loading="requestIs(`lifecycle:publish_revision:${revision.id}`)"
              :disabled="Boolean(pendingRequest) || (draft.status === 'published' && revision.id === draft.publishedRevisionId) || !publishSlug.trim()"
              @click="proposeRevisionPublication(revision)"
            >
              {{ publicationLabel(revision) }}
            </UButton>
          </li>
        </ol>
      </section>
    </section>
    <aside class="live-preview"><p><strong>Live preview</strong></p><CvDocument :document="draft" /></aside>

    <UModal
      v-model:open="cvDetailsOpen"
      title="CV details"
      description="Set this CV's name and target role. Your name and email become the defaults for future CVs."
      :ui="{ content: 'sm:max-w-xl', footer: 'justify-end' }"
    >
      <template #body>
        <div class="modal-form">
          <UFormField label="CV name" required>
            <UInput v-model="cvDetails.name" placeholder="Product lead CV" class="w-full" />
          </UFormField>
          <UFormField label="Name" required>
            <UInput v-model="cvDetails.personName" class="w-full" />
          </UFormField>
          <UFormField label="Target role">
            <UInput v-model="cvDetails.targetRole" class="w-full" />
          </UFormField>
          <UFormField label="Email">
            <UInput v-model="cvDetails.email" type="email" class="w-full" />
          </UFormField>
          <p class="modal-form-note">
            Name and email are saved to your Resume Studio account as defaults. They can still be changed for each CV.
          </p>
        </div>
      </template>
      <template #footer>
        <UButton
          color="neutral"
          variant="outline"
          :disabled="savingCvDetails"
          @click="cvDetailsOpen = false"
        >
          Cancel
        </UButton>
        <UButton
          :loading="savingCvDetails"
          :disabled="!cvDetails.name.trim() || !cvDetails.personName.trim()"
          @click="saveCvDetails"
        >
          Save CV details
        </UButton>
      </template>
    </UModal>

    <UModal
      v-model:open="sessionProposalOpen"
      title="Review Change Proposal"
      description="Nothing changes until you apply this proposal."
      scrollable
      :ui="{ content: 'sm:max-w-3xl', footer: 'justify-end' }"
    >
      <template #body>
        <article
          v-if="sessionChangeProposal"
          aria-label="Editing Session Change Proposal"
          class="proposal-review"
        >
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
        </article>
      </template>
      <template #footer>
        <UButton
          color="neutral"
          variant="outline"
          :loading="requestIs('discard-proposal')"
          :disabled="Boolean(pendingRequest)"
          @click="discardSessionChangeProposal"
        >
          Discard Change Proposal
        </UButton>
        <UButton
          :loading="requestIs('apply-proposal')"
          :disabled="Boolean(pendingRequest)"
          @click="applySessionChangeProposal"
        >
          Apply Proposed Changes
        </UButton>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.editor-layout { display: grid; grid-template-columns: minmax(23rem, .9fr) minmax(34rem, 1.1fr); gap: clamp(1.5rem, 3vw, 3rem); align-items: start; }
.editor-controls { min-width: 0; }
.editor-controls > h2, .editor-controls > section > h2 { margin-top: 2.5rem; padding-bottom: .55rem; border-bottom: 2px solid var(--ink); font-size: 1.8rem; font-weight: 400; }
.editor-session-bar { grid-column: 1 / -1; padding: 1rem; border: 1px solid var(--ink); background: var(--paper-light); box-shadow: 4px 4px 0 var(--paper-deep); }
.editor-session-bar-heading, .cv-details-summary { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.editor-session-bar h2 { margin: .15rem 0; font-family: var(--font-editorial); font-size: clamp(1.45rem, 2.5vw, 2rem); font-weight: 400; }
.editor-session-bar p { margin: 0; }
.editor-session-eyebrow { margin: 0; color: var(--marker-dark); font-family: var(--font-label); font-size: .65rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
.editor-session-list { margin-top: .75rem; border-top: 1px solid var(--paper-deep); }
.editor-archived-sessions { margin-top: .75rem; }
.cv-details-summary { margin-bottom: 1rem; padding: .85rem; border: 1px solid var(--ink); background: var(--paper-light); }
.cv-details-summary strong, .cv-details-summary span { display: block; }
.cv-details-summary span { margin-top: .2rem; color: var(--muted); font-size: .8rem; }
.modal-form { display: grid; gap: 1rem; }
.modal-form-note { margin: 0; color: var(--muted); font-size: .85rem; }
.live-preview { position: sticky; top: 1rem; transform-origin: top left; }
.live-preview > p { margin: 0 0 .65rem; font-family: var(--font-label); font-size: .68rem; letter-spacing: .1em; text-transform: uppercase; }
.library-row, .selection, .session-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: .85rem !important; margin: .6rem 0 !important; border: 1px solid var(--ink) !important; background: var(--paper-light); box-shadow: 3px 3px 0 var(--paper-deep); }
.library-row { display: block; }
.library-row-body { min-width: 0; padding: 0 .1rem .75rem; }
.library-row strong { display: block; font-family: var(--font-editorial); font-size: 1.05rem; }
.library-row-context { display: block; margin-top: .25rem; color: var(--muted); font-size: .8rem; }
.library-row-footer { display: flex; align-items: center; justify-content: space-between; gap: .65rem; padding-top: .65rem; border-top: 1px solid var(--paper-deep); }
.library-version-select { width: auto; min-width: 10rem; max-width: 14rem; }
.library-filters { display: grid; gap: .65rem; margin: 1rem 0; }
.block-kind-tabs { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .35rem; }
.block-kind-tabs .block-kind-tab { width: 100%; min-width: 0; margin: 0; box-shadow: none; }
.job-filter { display: flex; align-items: center; justify-content: stretch; gap: .5rem; }
.job-filter-select { flex: 1 1 auto; width: 100%; min-width: 0; }
.job-filter-clear { width: auto; margin: 0; }
.empty-library-filter { margin: 1rem 0; color: var(--muted); }
.selection button { width: auto; margin: 0 .15rem; }
.selection .selection-section { display: inline-flex; width: auto; min-width: 9rem; margin: 0 .3rem; }
.section-list { margin: 1.5rem 0; }
.section-list > h3 { font-family: var(--font-label); font-size: .72rem; letter-spacing: .1em; text-transform: uppercase; }
.selection-employer { margin: .75rem 0 1.25rem; padding-left: .9rem; border-left: 4px solid var(--marker); }
.selection-employer h4 { margin: 0 0 .6rem; }
.selection-employer h5 { margin: .7rem 0 .35rem; color: var(--muted); font-family: var(--font-label); font-size: .72rem; }
.proposal-review { margin: 0 !important; }
.proposal-review pre { max-height: 22rem; overflow: auto; padding: 1rem; background: var(--ink); color: var(--paper-light); font-family: var(--font-label); font-size: .7rem; }
@media (max-width: 1180px) { .editor-layout { grid-template-columns: 1fr; } .live-preview { position: static; } }
@media (max-width: 650px) { .selection, .session-row, .editor-session-bar-heading, .cv-details-summary { align-items: stretch; flex-direction: column; } .library-row-footer, .job-filter { align-items: stretch; flex-direction: column; } .library-version-select, .job-filter-select { width: 100%; max-width: none; } .selection .selection-section { width: 100%; margin: .4rem 0; } }
@media (min-width: 1500px) { .block-kind-tabs { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
@media print { .editor-controls, .editor-session-bar { display: none; } .editor-layout { display: block; } }
</style>
