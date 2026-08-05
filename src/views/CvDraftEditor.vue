<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { DragDropProvider } from "@dnd-kit/vue";
import { isSortable } from "@dnd-kit/vue/sortable";
import { Accessibility } from "@dnd-kit/dom";
import { useRoute, useRouter } from "vue-router";
import CvDocument from "../components/CvDocument.vue";
import TaskChat from "../components/TaskChat.vue";
import SortableCompositionItem from "../components/cv-builder/SortableCompositionItem.vue";
import { BLOCK_KINDS } from "../domain/blocks/blockLibrary";
import {
  addSelection,
  groupExperienceOccasions,
  moveExperienceOccasion,
  moveSelection,
  normalizeDraft,
  removeSelection,
  sortExperienceByJobDate,
} from "../domain/cvs/cvDraft";
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
const librarySearch = ref("");
const pendingRequest = ref("");
const cvDetailsOpen = ref(false);
const sessionProposalOpen = ref(false);
const savingCvDetails = ref(false);
const libraryCollapsed = ref(false);
const libraryDrawerOpen = ref(false);
const previewOpen = ref(false);
const previewWidth = ref(44);
const generationOpen = ref(false);
const copyRoleOpen = ref(false);
const archiveSessionOpen = ref(false);
const experienceUndoSnapshot = ref(null);
const autosaveState = ref("idle");
const autosaveError = ref("");
const experienceSort = ref("newest");
const expandedSections = reactive({
  experience: true,
  skills: false,
  certifications: false,
  education: false,
  interests: false,
});
let autosaveTimer = null;
let autosaveInFlight = false;
let autosaveQueued = false;
let localChangeVersion = 0;
let previewResizeCleanup = null;
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
  const query = librarySearch.value.trim().toLowerCase();
  if (query) {
    const employment = block.kind === "experience" ? employmentForBlock(block) : null;
    const haystack = [block.title, block.kind, employment?.employer, employment?.role]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  if (!selectedJobIds.value.length) return true;
  if (block.kind !== "experience") return false;
  return selectedJobIds.value.includes(employmentForBlock(block).occasionId);
}));
const selectedTheme = computed({
  get: () => draft.themeId || defaultThemeValue,
  set: (value) => {
    draft.themeId = value === defaultThemeValue ? null : value;
    markChanged();
  },
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
    markChanged();
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
function markChanged() {
  if (!activeSession.value) return;
  localChangeVersion += 1;
  autosaveState.value = "saving";
  autosaveError.value = "";
  if (autosaveInFlight) {
    autosaveQueued = true;
    return;
  }
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => autosave(), 450);
}
function add(block) {
  replaceDraft(addSelection(draft, selectionFor(block, selectedVersion(block))));
  markChanged();
}
function replaceVersion(block) {
  const selected = selectedForBlock(block.id);
  if (!selected) return add(block);
  const replacement = { ...selectionFor(block, selectedVersion(block), selected.section), order: selected.order };
  replaceDraft({ ...draft, selections: draft.selections.map((item) => item.blockId === block.id ? replacement : item) });
  markChanged();
}
function selectionVersionNumber(item) {
  if (item.block?.versionNumber) return item.block.versionNumber;
  return blocks.value.find((block) => block.id === item.blockId)?.versions.find((version) => version.id === item.versionId)?.number || "unknown";
}
function alignSelectedVersions() {
  for (const block of blocks.value) selectedVersions[block.id] = block.currentVersion?.id;
  for (const selection of draft.selections) selectedVersions[selection.blockId] = selection.versionId;
}
function remove(versionId) { replaceDraft(removeSelection(draft, versionId)); markChanged(); }
function shift(item, delta) { replaceDraft(moveSelection(draft, item.versionId, item.section, item.order + delta)); markChanged(); }
function changeSection(item, section) {
  replaceDraft(moveSelection(draft, item.versionId, section, draft.selections.filter((entry)=>entry.section===section).length));
  expandedSections[section] = true;
  markChanged();
}
function clearDraft() { if (window.confirm("Remove every selected Block Version from this CV?")) { replaceDraft({ ...draft, selections: [] }); markChanged(); } }
const selectedBySection = computed(() => Object.groupBy(draft.selections, (item) => item.section));
const selectedExperienceOccasions = computed(() => groupExperienceOccasions(selectedBySection.value.experience));
const openEditingSessions = computed(() => editingSessions.value.filter((item) => item.status === "open"));
const archivedEditingSessions = computed(() => editingSessions.value.filter((item) => item.status === "archived"));
const activeBaseRevisionNumber = computed(() => activeSession.value?.baseRevisionNumber || revisions.value.find((item) => item.id === activeSession.value?.baseRevisionId)?.number || null);
const publishedRevisionNumber = computed(() => revisions.value.find((item) => item.id === draft.publishedRevisionId)?.number || null);
const autosaveLabel = computed(() => ({
  idle: activeSession.value ? "Saved" : "Not created",
  saving: "Saving…",
  saved: "Saved",
  conflict: "Conflict — reload required",
}[autosaveState.value]));
const compositionCount = computed(() => draft.selections.length);
const accessibilityPlugins = (defaults) => defaults.map((plugin) => (
  plugin === Accessibility
    ? {
        plugin: Accessibility,
        options: {
          screenReaderInstructions: {
            draggable: "Press Space or Enter to pick up this CV item. Use the arrow keys to move it, then press Space or Enter to drop. Press Escape to cancel.",
          },
          announcements: {
            dragstart: ({ operation }) => `Picked up ${operation.source?.data?.label || "CV item"}.`,
            dragover: ({ operation }) => operation.target
              ? `${operation.source?.data?.label || "CV item"} moved over ${operation.target.data?.label || "a new position"}.`
              : undefined,
            dragend: ({ operation, canceled }) => canceled
              ? `Reordering ${operation.source?.data?.label || "CV item"} was cancelled.`
              : `${operation.source?.data?.label || "CV item"} was dropped.`,
          },
        },
      }
    : plugin
));
const sessionActionItems = computed(() => activeSession.value ? [[
  {
    label: "Copy to New Version",
    icon: "i-lucide-copy-plus",
    disabled: Boolean(pendingRequest.value),
    onSelect: () => copyFrom(activeSession.value, "copy_to_new_version"),
  },
  {
    label: "Copy for New Role",
    icon: "i-lucide-briefcase-business",
    disabled: Boolean(pendingRequest.value),
    onSelect: () => { copyRoleOpen.value = true; },
  },
], [
  {
    label: "Archive Editing Session",
    icon: "i-lucide-archive",
    color: "error",
    disabled: Boolean(pendingRequest.value),
    onSelect: () => { archiveSessionOpen.value = true; },
  },
]] : []);
function editingSessionLabel(session) {
  return session.baseRevisionNumber
    ? `Editing Session based on Revision ${session.baseRevisionNumber}`
    : "Initial Editing Session";
}

function toggleSection(section) {
  expandedSections[section] = !expandedSections[section];
  sessionStorage.setItem(
    `cv-workbench-sections:${activeSession.value?.id || "new"}`,
    JSON.stringify(expandedSections),
  );
}

function restoreSectionState() {
  const stored = sessionStorage.getItem(`cv-workbench-sections:${activeSession.value?.id || "new"}`);
  if (!stored) return;
  try {
    Object.assign(expandedSections, JSON.parse(stored));
  } catch {
    sessionStorage.removeItem(`cv-workbench-sections:${activeSession.value?.id || "new"}`);
  }
}

function toggleLibrary() {
  libraryCollapsed.value = !libraryCollapsed.value;
  sessionStorage.setItem("cv-workbench-library-collapsed", String(libraryCollapsed.value));
}

function selectionMenuItems(item) {
  const siblings = selectedBySection.value[item.section] || [];
  const index = siblings.findIndex((entry) => entry.versionId === item.versionId);
  return [[
    { label: "Move up", icon: "i-lucide-arrow-up", disabled: index <= 0, onSelect: () => shift(item, -1) },
    { label: "Move down", icon: "i-lucide-arrow-down", disabled: index < 0 || index >= siblings.length - 1, onSelect: () => shift(item, 1) },
    { label: "Move to top", icon: "i-lucide-chevrons-up", disabled: index <= 0, onSelect: () => { replaceDraft(moveSelection(draft, item.versionId, item.section, 0)); markChanged(); } },
    { label: "Move to bottom", icon: "i-lucide-chevrons-down", disabled: index < 0 || index >= siblings.length - 1, onSelect: () => { replaceDraft(moveSelection(draft, item.versionId, item.section, siblings.length - 1)); markChanged(); } },
  ], [{
    label: "Move to section…",
    icon: "i-lucide-move-right",
    children: compositionSectionItems
      .filter((section) => section !== item.section)
      .map((section) => ({
        label: section.charAt(0).toUpperCase() + section.slice(1),
        onSelect: () => changeSection(item, section),
      })),
  }], [{
    label: "Remove from CV",
    icon: "i-lucide-trash-2",
    color: "error",
    onSelect: () => remove(item.versionId),
  }]];
}

function occasionMenuItems(occasion, index) {
  const last = selectedExperienceOccasions.value.length - 1;
  const move = (order) => {
    replaceDraft(moveExperienceOccasion(draft, occasion.occasionId, order));
    experienceSort.value = "custom";
    markChanged();
  };
  return [[
    { label: "Move job up", icon: "i-lucide-arrow-up", disabled: index <= 0, onSelect: () => move(index - 1) },
    { label: "Move job down", icon: "i-lucide-arrow-down", disabled: index >= last, onSelect: () => move(index + 1) },
    { label: "Move job to top", icon: "i-lucide-chevrons-up", disabled: index <= 0, onSelect: () => move(0) },
    { label: "Move job to bottom", icon: "i-lucide-chevrons-down", disabled: index >= last, onSelect: () => move(last) },
  ]];
}

function onSelectionDragEnd(event, section) {
  if (event.canceled || !isSortable(event.operation.source)) return;
  const source = event.operation.source;
  if (source.initialIndex === source.index) return;
  const item = selectedBySection.value[section]?.[source.initialIndex];
  if (!item) return;
  replaceDraft(moveSelection(draft, item.versionId, section, source.index));
  markChanged();
}

function onOccasionDragEnd(event) {
  if (event.canceled || !isSortable(event.operation.source)) return;
  const source = event.operation.source;
  if (source.initialIndex === source.index) return;
  const occasion = selectedExperienceOccasions.value[source.initialIndex];
  if (!occasion) return;
  replaceDraft(moveExperienceOccasion(draft, occasion.occasionId, source.index));
  experienceSort.value = "custom";
  markChanged();
}

function onOccasionItemDragEnd(event, occasion) {
  if (event.canceled || !isSortable(event.operation.source)) return;
  const source = event.operation.source;
  if (source.initialIndex === source.index) return;
  const item = occasion.items[source.initialIndex];
  if (!item) return;
  const targetItem = occasion.items[source.index];
  const targetOrder = targetItem?.order ?? item.order;
  replaceDraft(moveSelection(draft, item.versionId, "experience", targetOrder));
  experienceSort.value = "custom";
  markChanged();
}

function sortExperience(direction) {
  experienceUndoSnapshot.value = plainSnapshot(draft);
  replaceDraft(sortExperienceByJobDate(draft, direction));
  experienceSort.value = direction;
  markChanged();
  notice.value = `Experience sorted ${direction === "newest" ? "newest first" : "oldest first"}.`;
}

function undoExperienceSort() {
  if (!experienceUndoSnapshot.value) return;
  replaceDraft(experienceUndoSnapshot.value);
  experienceUndoSnapshot.value = null;
  experienceSort.value = "custom";
  markChanged();
  notice.value = "Experience order restored.";
}

function applySummaryProposal() {
  replaceDraft(cvWorkspace.acceptSummary(draft, proposal.value));
  proposal.value = null;
  markChanged();
}

function setPreviewWidth(value) {
  previewWidth.value = Math.max(34, Math.min(72, Number(value) || 44));
  document.documentElement.style.setProperty("--cv-preview-width", `${previewWidth.value}vw`);
  sessionStorage.setItem("cv-preview-width", String(previewWidth.value));
}

function startPreviewResize(event) {
  const startX = event.clientX;
  const startWidth = previewWidth.value;
  const onMove = (moveEvent) => {
    const delta = ((startX - moveEvent.clientX) / window.innerWidth) * 100;
    setPreviewWidth(startWidth + delta);
  };
  const onEnd = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onEnd);
    previewResizeCleanup = null;
  };
  previewResizeCleanup = onEnd;
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onEnd);
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
  autosaveState.value = "saved";
  autosaveError.value = "";
  restoreSectionState();
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
  libraryCollapsed.value = sessionStorage.getItem("cv-workbench-library-collapsed") === "true";
  restoreSectionState();
  const storedPreviewWidth = sessionStorage.getItem("cv-preview-width");
  setPreviewWidth(storedPreviewWidth || 44);
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
      const requestedSession = route.query?.session
        ? sessions.find((session) => session.id === route.query.session && session.status === "open")
        : null;
      if (requestedSession) {
        activateEditingSession(
          await cvWorkspace.resumeEditingSession(requestedSession.id),
          requestedSession.baseRevisionNumber,
        );
      }
    } else if (profileDefaults) {
      draft.profile.basics.name ||= profileDefaults.name;
      draft.profile.basics.email ||= profileDefaults.email;
    }
    alignSelectedVersions();
    status.value = "loaded";
  } catch (reason) { error.value = reason.message; status.value = reason.code === "not-found" ? "missing" : "failed"; }
});

onBeforeUnmount(() => {
  window.clearTimeout(autosaveTimer);
  previewResizeCleanup?.();
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

async function autosave() {
  if (autosaveInFlight) {
    autosaveQueued = true;
    return;
  }
  if (!activeSession.value || saving.value || pendingRequest.value) {
    if (activeSession.value) autosaveTimer = window.setTimeout(() => autosave(), 450);
    return;
  }
  autosaveInFlight = true;
  autosaveQueued = false;
  autosaveState.value = "saving";
  const changeVersion = localChangeVersion;
  try {
    const sessionSnapshot = plainSnapshot(activeSession.value);
    const draftSnapshot = plainSnapshot(draft);
    const saved = await cvWorkspace.saveEditingSession({
      ...sessionSnapshot,
      ...draftSnapshot,
      id: activeSession.value.id,
      cvId: draft.id,
      optimisticVersion: activeSession.value.optimisticVersion,
    });
    activeSession.value = {
      ...saved,
      baseRevisionNumber: saved.baseRevisionNumber || activeBaseRevisionNumber.value,
    };
    autosaveState.value = changeVersion === localChangeVersion ? "saved" : "saving";
  } catch (reason) {
    autosaveState.value = "conflict";
    autosaveError.value = reason.message;
  } finally {
    autosaveInFlight = false;
    if (autosaveQueued && autosaveState.value !== "conflict") {
      autosaveTimer = window.setTimeout(() => autosave(), 0);
    }
  }
}

async function recoverAutosaveConflict() {
  if (!activeSession.value) return;
  await resumeEditingSession(activeSession.value);
  autosaveState.value = "saved";
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
    await router.replace(`/app/cvs/${session.cvId}/edit`);
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
      if (operationType === "copy_for_new_role") await router.replace(`/app/cvs/${applied.result.cvId}/edit`);
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
    if (operationType === "finish_editing_session") {
      await router.replace(`/app/cvs/${applied.result.cvId || draft.id}`);
    }
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
    markChanged();
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
  <div v-else class="cv-workbench" :class="{ 'cv-workbench--library-collapsed': libraryCollapsed }">
    <header class="workbench-header">
      <div class="workbench-identity">
        <NuxtLink class="workbench-back" to="/app/cvs" aria-label="Back to saved CVs"><UIcon name="i-lucide-arrow-left" /></NuxtLink>
        <div>
          <p class="editor-session-eyebrow">CV Workbench · {{ activeSession ? `working version ${activeSession.optimisticVersion}` : "new composition" }}</p>
          <button type="button" class="workbench-title" @click="openCvDetails">{{ draft.name || "Untitled CV" }} <UIcon name="i-lucide-pencil" /></button>
          <p class="workbench-subtitle">{{ draft.profile.basics.label || "Add a target role" }}</p>
        </div>
      </div>
      <div class="workbench-actions">
        <button v-if="activeSession" type="button" class="autosave-status" :class="`autosave-status--${autosaveState}`" :title="autosaveError || autosaveLabel" @click="autosaveState === 'conflict' && recoverAutosaveConflict()">
          <UIcon :name="autosaveState === 'saving' ? 'i-lucide-loader-circle' : autosaveState === 'conflict' ? 'i-lucide-triangle-alert' : 'i-lucide-cloud-check'" /> {{ autosaveLabel }}
        </button>
        <UButton class="mobile-library-button secondary" color="neutral" variant="outline" icon="i-lucide-library" @click="libraryDrawerOpen = true">Blocks</UButton>
        <UButton color="neutral" variant="outline" icon="i-lucide-panel-right-open" @click="previewOpen = true">Preview</UButton>
        <UButton v-if="!draft.id" :loading="requestIs('save-session')" :disabled="Boolean(pendingRequest)" @click="save">Create CV</UButton>
        <UButton v-if="activeSession" :loading="requestIs('finish-session')" :disabled="Boolean(pendingRequest) || autosaveState === 'saving'" @click="finishEditingSession">Finish Revision</UButton>
        <UDropdownMenu v-if="activeSession" :items="sessionActionItems" :content="{ align: 'end' }">
          <UButton color="neutral" variant="outline" icon="i-lucide-ellipsis" aria-label="Editing Session actions" />
        </UDropdownMenu>
      </div>
    </header>

    <div v-if="error" class="workbench-message workbench-message--error" role="alert">{{ error }}</div>
    <p v-if="notice" class="workbench-message" role="status">{{ notice }}</p>

    <div class="workbench-body">
      <aside class="block-library" :class="{ 'block-library--open': libraryDrawerOpen }" aria-label="CV Block Library">
        <header class="library-header">
          <div v-if="!libraryCollapsed"><p class="editor-session-eyebrow">Source material</p><h2>Block Library</h2></div>
          <UButton class="library-collapse-button secondary" color="neutral" variant="ghost" :icon="libraryCollapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'" :aria-label="libraryCollapsed ? 'Expand Block Library' : 'Collapse Block Library'" @click="toggleLibrary" />
          <UButton class="library-mobile-close" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Close Block Library" @click="libraryDrawerOpen = false" />
        </header>
        <template v-if="!libraryCollapsed">
          <UInput v-model="librarySearch" class="library-search" icon="i-lucide-search" placeholder="Search blocks" aria-label="Search CV Blocks" />
          <div class="block-kind-tabs" role="tablist" aria-label="Filter CV Blocks by type">
            <UButton v-for="item in blockKindItems" :key="item.value" class="block-kind-tab" color="secondary" :variant="blockKindFilter === item.value ? 'solid' : 'outline'" role="tab" size="xs" :aria-selected="blockKindFilter === item.value" @click="blockKindFilter = item.value">{{ item.label }}</UButton>
          </div>
          <div v-if="jobFilterItems.length" class="job-filter">
            <USelectMenu v-model="selectedJobIds" :items="jobFilterItems" value-key="value" label-key="label" multiple searchable size="sm" class="job-filter-select" placeholder="All jobs" aria-label="Filter CV Blocks by jobs">
              <template #default="{ modelValue }"><span>{{ modelValue.length ? `${modelValue.length} jobs` : "All jobs" }}</span></template>
            </USelectMenu>
            <UButton v-if="selectedJobIds.length" color="neutral" variant="ghost" size="xs" @click="selectedJobIds = []">Clear</UButton>
          </div>
          <div class="library-utility-row"><span>{{ filteredBlocks.length }} of {{ blocks.length }} blocks</span><UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-sparkles" @click="generationOpen = true">Draft from notes</UButton></div>
          <p v-if="!blocks.length" class="library-empty">No CV Blocks available. <NuxtLink to="/app/blocks">Create CV Blocks first.</NuxtLink></p>
          <p v-else-if="!filteredBlocks.length" class="library-empty">No CV Blocks match these filters.</p>
          <div class="library-results">
            <article v-for="block in filteredBlocks" :key="block.id" class="library-card">
              <div><small>{{ block.kind }}</small><strong>{{ block.title }}</strong><span v-if="experienceParentJob(block)">{{ experienceParentJob(block) }}</span></div>
              <footer>
                <USelect v-model="selectedVersions[block.id]" :items="blockVersionItems(block)" size="xs" aria-label="Block Version" />
                <UButton v-if="!selectedForBlock(block.id)" size="xs" icon="i-lucide-plus" @click="add(block)">Add</UButton>
                <UButton v-else color="neutral" variant="outline" size="xs" :disabled="selectedForBlock(block.id).versionId === selectedVersions[block.id]" @click="replaceVersion(block)">Replace</UButton>
              </footer>
            </article>
          </div>
        </template>
      </aside>
      <button v-if="libraryDrawerOpen" class="library-scrim" type="button" aria-label="Close Block Library" @click="libraryDrawerOpen = false" />

      <main class="composition-canvas">
        <section v-if="draft.id && !activeSession" class="session-gate" aria-labelledby="editing-sessions-heading">
          <p class="editor-session-eyebrow">Editing Session required</p><h1 id="editing-sessions-heading">Choose a working version</h1><p>Resume an open Editing Session or start from an immutable Revision before changing this CV.</p>
          <article v-for="session in openEditingSessions" :key="session.id" class="session-row"><span>{{ editingSessionLabel(session) }} · working version {{ session.optimisticVersion }}</span><UButton :loading="requestIs(`resume-session:${session.id}`)" :disabled="Boolean(pendingRequest)" @click="resumeEditingSession(session)">Resume</UButton></article>
          <UButton v-if="!openEditingSessions.length && !revisions.length" :loading="requestIs('start-session:initial')" :disabled="Boolean(pendingRequest)" @click="startEditingSession(null)">Start first Editing Session</UButton>
          <div v-if="revisions.length" class="revision-start-list"><UButton v-for="revision in revisions" :key="revision.id" color="neutral" variant="outline" :loading="requestIs(`start-session:${revision.id}`)" :disabled="Boolean(pendingRequest)" @click="startEditingSession(revision)">Start from Revision {{ revision.number }}</UButton></div>
          <details v-if="archivedEditingSessions.length"><summary>Archived Editing Sessions</summary><article v-for="session in archivedEditingSessions" :key="session.id" class="session-row"><span>Working version {{ session.optimisticVersion }}</span><UButton color="neutral" variant="outline" @click="proposeSessionLifecycle(session, 'restore_editing_session')">Restore</UButton></article></details>
        </section>
        <template v-else>
          <header class="composition-header">
            <div><p class="editor-session-eyebrow">Working Composition</p><h1>Build the story, one block at a time.</h1><p>{{ compositionCount }} selected Block Version{{ compositionCount === 1 ? "" : "s" }}. Drag by the handles to reorder.</p></div>
            <div class="composition-settings"><UButton class="secondary" color="neutral" variant="outline" icon="i-lucide-file-pen-line" @click="openCvDetails">CV details</UButton><USelect v-model="selectedTheme" :items="themeItems" aria-label="Theme" /></div>
          </header>

          <div class="composition-toolbar">
            <UButton v-if="draft.selections.length" class="secondary" color="neutral" variant="ghost" @click="clearDraft">Clear composition…</UButton>
            <UButton v-if="sessionChangeProposal && !sessionProposalOpen" class="secondary" color="neutral" variant="outline" @click="sessionProposalOpen = true">Review pending Change Proposal</UButton>
          </div>

          <section class="composition-section" :class="{ 'composition-section--open': expandedSections.experience }">
            <header class="composition-section-header">
              <button type="button" class="secondary" @click="toggleSection('experience')"><UIcon :name="expandedSections.experience ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" /><span>Experience</span><small>{{ selectedBySection.experience?.length || 0 }}</small></button>
              <div class="experience-sort-actions">
                <UButton v-if="experienceUndoSnapshot" color="neutral" variant="ghost" size="xs" icon="i-lucide-undo-2" @click="undoExperienceSort">Undo sort</UButton>
                <USelect :model-value="experienceSort" :items="[{ label: 'Newest first', value: 'newest' }, { label: 'Oldest first', value: 'oldest' }, { label: 'Custom order', value: 'custom', disabled: true }]" size="xs" aria-label="Sort Experience by job date" @update:model-value="$event !== 'custom' && sortExperience($event)" />
              </div>
            </header>
            <div v-show="expandedSections.experience" class="composition-section-body">
              <p v-if="!selectedExperienceOccasions.length" class="composition-empty">Add Experience blocks from the library.</p>
              <DragDropProvider v-else :plugins="accessibilityPlugins" @drag-end="onOccasionDragEnd">
                <SortableCompositionItem v-for="(occasion, occasionIndex) in selectedExperienceOccasions" :id="occasion.occasionId" :key="occasion.occasionId" :index="occasionIndex" group="experience-occasions" :label="`${occasion.role} at ${occasion.employer}`" class="occasion-card">
                  <header class="occasion-header"><div><strong>{{ occasion.role }}</strong><span>{{ occasion.employer }} · {{ formatEmploymentPeriod(occasion.startDate, occasion.endDate) }}</span></div><div class="occasion-actions"><small>{{ occasion.items.length }} block{{ occasion.items.length === 1 ? "" : "s" }}</small><UDropdownMenu :items="occasionMenuItems(occasion, occasionIndex)" :content="{ align: 'end' }"><UButton color="neutral" variant="ghost" icon="i-lucide-ellipsis" aria-label="Job order actions" /></UDropdownMenu></div></header>
                  <DragDropProvider :plugins="accessibilityPlugins" @drag-end="onOccasionItemDragEnd($event, occasion)">
                    <SortableCompositionItem v-for="(item, itemIndex) in occasion.items" :id="item.versionId" :key="item.versionId" :index="itemIndex" :group="occasion.occasionId" :label="item.block?.title || item.content?.text || 'Experience block'" class="selection-card">
                      <div class="selection-copy"><strong>{{ item.block?.title || item.content?.text }}</strong><small>Block Version {{ selectionVersionNumber(item) }}</small></div>
                      <UDropdownMenu :items="selectionMenuItems(item)" :content="{ align: 'end' }"><UButton class="secondary" color="neutral" variant="ghost" icon="i-lucide-ellipsis" aria-label="Block actions" /></UDropdownMenu>
                    </SortableCompositionItem>
                  </DragDropProvider>
                </SortableCompositionItem>
              </DragDropProvider>
            </div>
          </section>

          <section v-for="section in ['skills','certifications','education','interests']" :key="section" class="composition-section" :class="{ 'composition-section--open': expandedSections[section] }">
            <header class="composition-section-header"><button type="button" class="secondary" @click="toggleSection(section)"><UIcon :name="expandedSections[section] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" /><span>{{ section }}</span><small>{{ selectedBySection[section]?.length || 0 }}</small></button></header>
            <div v-show="expandedSections[section]" class="composition-section-body">
              <p v-if="!selectedBySection[section]?.length" class="composition-empty">Add {{ section }} blocks from the library.</p>
              <DragDropProvider v-else :plugins="accessibilityPlugins" @drag-end="onSelectionDragEnd($event, section)">
                <SortableCompositionItem v-for="(item, itemIndex) in selectedBySection[section]" :id="item.versionId" :key="item.versionId" :index="itemIndex" :group="section" :label="item.block?.title || item.content?.text || item.content?.name || section" class="selection-card">
                  <div class="selection-copy"><strong>{{ item.block?.title || item.content?.text || item.content?.name }}</strong><small>Block Version {{ selectionVersionNumber(item) }}</small></div>
                  <UDropdownMenu :items="selectionMenuItems(item)" :content="{ align: 'end' }"><UButton class="secondary" color="neutral" variant="ghost" icon="i-lucide-ellipsis" aria-label="Block actions" /></UDropdownMenu>
                </SortableCompositionItem>
              </DragDropProvider>
            </div>
          </section>
        </template>
      </main>
    </div>

    <USlideover v-model:open="previewOpen" title="CV preview" description="Live preview of the current Working Composition." :ui="{ content: 'cv-preview-slideover', body: 'cv-preview-body', footer: 'justify-between' }">
      <template #body><button type="button" class="preview-resize-handle" aria-label="Resize preview" @pointerdown="startPreviewResize" /><div class="preview-paper"><CvDocument :document="draft" /></div></template>
      <template #footer><span class="preview-width-label">{{ Math.round(previewWidth) }}% wide</span><NuxtLink v-if="draft.id" role="button" class="secondary control-compact" :to="`/app/cvs/${draft.id}/preview`">Open A4 print preview</NuxtLink></template>
    </USlideover>

    <UModal v-model:open="generationOpen" title="Draft from notes" description="Generate candidates, review them, then add only the Block Versions you approve." scrollable :ui="{ content: 'sm:max-w-4xl' }">
      <template #body>
        <section class="summary-generator"><h3>Summary Change Proposal</h3><label>Direction<UInput v-model="instruction" placeholder="Focus on product leadership" /></label><UButton :loading="generatingSummary" :disabled="Boolean(pendingRequest)" @click="generateSummary">Generate Summary Change Proposal</UButton><article v-if="proposal"><label>Edit proposal<UTextarea v-model="proposal.text" aria-label="Edit Summary Change Proposal" /></label><div class="modal-actions"><UButton @click="applySummaryProposal">Apply Change Proposal</UButton><UButton color="neutral" variant="outline" @click="proposal=null">Discard</UButton></div></article></section>
        <TaskChat :generate-tasks-handler="generateTaskProposal" :create-tasks-handler="createReviewedTasks" />
      </template>
    </UModal>

    <UModal v-model:open="copyRoleOpen" title="Copy for New Role" description="Create a separate CV and initial Editing Session for another target role." :ui="{ content: 'sm:max-w-lg', footer: 'justify-end' }">
      <template #body><UFormField label="New role-focused CV name" required><UInput v-model="copyRoleName" class="w-full" placeholder="Head of Marketing at Acme" /></UFormField></template>
      <template #footer><UButton color="neutral" variant="outline" @click="copyRoleOpen = false">Cancel</UButton><UButton :disabled="!copyRoleName.trim() || Boolean(pendingRequest)" @click="copyFrom(activeSession, 'copy_for_new_role'); copyRoleOpen = false">Review copy proposal</UButton></template>
    </UModal>

    <UModal v-model:open="archiveSessionOpen" title="Archive Editing Session?" description="The Working Composition will leave the active workbench. You can restore it later." :ui="{ content: 'sm:max-w-lg', footer: 'justify-end' }">
      <template #footer><UButton color="neutral" variant="outline" @click="archiveSessionOpen = false">Cancel</UButton><UButton color="error" :disabled="Boolean(pendingRequest)" @click="proposeSessionLifecycle(activeSession, 'archive_editing_session'); archiveSessionOpen = false">Review archive proposal</UButton></template>
    </UModal>

    <template v-if="false">
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
    </template>

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
.cv-workbench {
  --library-width: 19rem;
  min-height: calc(100vh - 4rem);
  background:
    linear-gradient(rgba(25, 24, 22, .035) 1px, transparent 1px),
    var(--paper);
  background-size: 100% 2rem;
}
.workbench-header {
  position: sticky;
  z-index: 30;
  top: 0;
  display: flex;
  min-height: 5.25rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: .8rem 1rem;
  border-bottom: 2px solid var(--ink);
  background: color-mix(in srgb, var(--paper-light) 94%, transparent);
  backdrop-filter: blur(12px);
}
.workbench-identity, .workbench-actions, .composition-settings, .library-header, .library-utility-row, .occasion-header, .selection-card :deep(.sortable-composition-content) { display: flex; align-items: center; }
.workbench-identity { min-width: 0; gap: .8rem; }
.workbench-back { display: grid; width: 2.6rem; height: 2.6rem; flex: 0 0 auto; place-items: center; border: 1px solid var(--ink); color: var(--ink); }
.workbench-title { display: flex; max-width: 36rem; align-items: center; gap: .45rem; margin: .1rem 0 0; overflow: hidden; border: 0; background: none; color: var(--ink); font-family: var(--font-editorial); font-size: clamp(1.35rem, 2vw, 1.85rem); text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.workbench-title .icon { width: .85rem; color: var(--muted); }
.workbench-subtitle { margin: 0; color: var(--muted); font-size: .78rem; }
.workbench-actions { flex-wrap: wrap; justify-content: flex-end; gap: .5rem; }
.autosave-status { display: flex; align-items: center; gap: .35rem; border: 0; background: transparent; color: var(--muted); font-family: var(--font-label); font-size: .7rem; }
.autosave-status--saving .icon { animation: workbench-spin .8s linear infinite; }
.autosave-status--conflict { color: #9b2c2c; cursor: pointer; }
@keyframes workbench-spin { to { transform: rotate(360deg); } }
.workbench-message { margin: 0; padding: .65rem 1rem; border-bottom: 1px solid var(--ink); background: var(--paper-light); font-size: .8rem; }
.workbench-message--error { background: #fff0ed; color: #8f221b; }
.workbench-body { display: grid; grid-template-columns: var(--library-width) minmax(0, 1fr); min-height: calc(100vh - 5.25rem); }
.cv-workbench--library-collapsed { --library-width: 3.75rem; }
.block-library { position: sticky; top: 5.25rem; height: calc(100vh - 5.25rem); overflow: hidden; border-right: 1px solid var(--ink); background: var(--paper-light); transition: width 180ms ease; }
.library-header { min-height: 4.5rem; justify-content: space-between; gap: .5rem; padding: .75rem; border-bottom: 1px solid var(--ink); }
.library-header h2 { margin: .15rem 0 0; font-family: var(--font-editorial); font-size: 1.25rem; font-weight: 500; }
.library-collapse-button { margin-left: auto; }
.cv-workbench--library-collapsed .library-header {
  justify-content: center;
  padding: .5rem;
}
.cv-workbench--library-collapsed .library-collapse-button {
  width: 2.75rem;
  min-width: 2.75rem;
  height: 2.75rem;
  min-height: 2.75rem;
  aspect-ratio: 1;
  margin: 0;
  padding: 0 !important;
}
.library-mobile-close, .mobile-library-button { display: none !important; }
.library-search { width: calc(100% - 1.5rem); margin: .75rem; }
.block-kind-tabs { display: flex !important; gap: .35rem; padding: 0 .75rem .6rem; overflow-x: auto; }
.block-kind-tabs .block-kind-tab { flex: 0 0 auto; width: auto; margin: 0; box-shadow: none; }
.job-filter { display: flex; gap: .35rem; padding: 0 .75rem .6rem; }
.job-filter-select { min-width: 0; flex: 1; }
.library-utility-row { justify-content: space-between; gap: .5rem; padding: .55rem .75rem; border-block: 1px solid var(--paper-deep); color: var(--muted); font-size: .7rem; }
.library-results { height: calc(100vh - 17.5rem); overflow-y: auto; padding: .2rem .75rem 2rem; }
.library-card { margin: .65rem 0; padding: .7rem !important; border: 1px solid var(--ink) !important; background: var(--paper); box-shadow: 2px 2px 0 var(--paper-deep); }
.library-card small, .library-card strong, .library-card span { display: block; }
.library-card small { color: var(--marker-dark); font-family: var(--font-label); font-size: .6rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.library-card strong { margin-top: .15rem; font-family: var(--font-editorial); font-size: .96rem; }
.library-card span { margin-top: .15rem; color: var(--muted); font-size: .7rem; }
.library-card footer { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .45rem; margin-top: .6rem; padding-top: .55rem; border-top: 1px solid var(--paper-deep); }
.library-empty { padding: 1rem; color: var(--muted); font-size: .8rem; }
.composition-canvas { width: min(100%, 62rem); min-width: 0; margin: 0 auto; padding: clamp(1rem, 3vw, 3rem); }
.composition-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 2rem; margin-bottom: 2rem; }
.composition-header h1, .session-gate h1 { margin: .25rem 0; font-family: var(--font-editorial); font-size: clamp(2rem, 4vw, 3.5rem); font-weight: 400; line-height: .98; }
.composition-header p { margin: .4rem 0 0; color: var(--muted); }
.composition-settings { flex: 0 0 auto; gap: .5rem; }
.composition-section { margin: 0 0 1rem; border: 1px solid var(--ink); background: var(--paper-light); box-shadow: 4px 4px 0 var(--paper-deep); }
.composition-section--open { box-shadow: 6px 6px 0 color-mix(in srgb, var(--marker) 55%, var(--paper-deep)); }
.composition-section-header { display: flex; min-height: 3.65rem; align-items: center; justify-content: space-between; gap: .7rem; padding: .55rem .7rem; }
.composition-section-header > button { display: flex; flex: 1; align-items: center; gap: .65rem; border: 0; background: transparent; color: var(--ink); text-align: left; cursor: pointer; }
.composition-section-header span { font-family: var(--font-label); font-size: .75rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
.composition-section-header small { display: grid; min-width: 1.5rem; height: 1.5rem; place-items: center; border-radius: 50%; background: var(--paper-deep); font-size: .65rem; }
.experience-sort-actions, .occasion-actions { display: flex; align-items: center; gap: .35rem; }
.composition-section-body { display: grid; gap: .75rem; padding: .8rem; border-top: 1px solid var(--ink); }
.composition-empty { margin: 0; padding: 1.2rem; border: 1px dashed var(--muted); color: var(--muted); text-align: center; }
.occasion-card { margin-bottom: .85rem; }
.occasion-card :deep(> .sortable-composition-content) { padding: .8rem; }
.occasion-header { justify-content: space-between; gap: .8rem; margin-bottom: .65rem; }
.occasion-header strong, .occasion-header span { display: block; }
.occasion-header strong { font-family: var(--font-editorial); font-size: 1.12rem; }
.occasion-header span, .occasion-header small { color: var(--muted); font-size: .72rem; }
.selection-card { margin: .45rem 0; box-shadow: none; }
.selection-card :deep(> .sortable-composition-content) { display: flex; min-height: 3.2rem; align-items: center; justify-content: space-between; gap: .75rem; padding: .5rem .6rem; }
.selection-copy { min-width: 0; }
.selection-copy strong, .selection-copy small { display: block; }
.selection-copy strong { overflow: hidden; font-size: .82rem; text-overflow: ellipsis; white-space: nowrap; }
.selection-copy small { margin-top: .1rem; color: var(--muted); font-size: .65rem; }
.composition-toolbar { display: flex; justify-content: flex-end; gap: .75rem; margin: -1rem 0 1rem; }
.session-gate { max-width: 46rem; margin: 4rem auto; padding: 2rem; border: 1px solid var(--ink); background: var(--paper-light); box-shadow: 7px 7px 0 var(--marker); }
.revision-start-list { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: 1rem; }
.library-scrim { display: none; }
.preview-paper { min-width: 38rem; padding: 1.5rem; }
.preview-resize-handle { position: absolute; z-index: 10; top: 0; bottom: 0; left: -.3rem; width: .6rem; border: 0; background: transparent; cursor: ew-resize; touch-action: none; }
.preview-resize-handle::after { position: absolute; top: 45%; bottom: 45%; left: .25rem; width: 2px; background: var(--marker); content: ""; }
.preview-width-label { color: var(--muted); font-family: var(--font-label); font-size: .7rem; }
.summary-generator { display: grid; gap: .75rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--ink); }
.summary-generator h3 { margin: 0; font-family: var(--font-editorial); font-size: 1.5rem; }
.modal-actions { display: flex; gap: .5rem; margin-top: .65rem; }
:global(.cv-preview-slideover) { width: var(--cv-preview-width, 44vw) !important; max-width: none !important; }
:global(.cv-preview-body) { position: relative; overflow: auto; padding: 0 !important; background: var(--paper-deep); }

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

@media (max-width: 900px) {
  .workbench-header { align-items: flex-start; flex-direction: column; }
  .workbench-actions { width: 100%; justify-content: flex-start; }
  .mobile-library-button, .library-mobile-close { display: inline-flex !important; }
  .library-collapse-button { display: none !important; }
  .workbench-body { display: block; }
  .block-library { position: fixed; z-index: 60; top: 0; bottom: 0; left: 0; width: min(90vw, 24rem); height: 100vh; transform: translateX(-105%); transition: transform 180ms ease; }
  .block-library--open { transform: translateX(0); }
  .block-library--open > template { display: block; }
  .library-results { height: calc(100vh - 17.5rem); }
  .library-scrim { position: fixed; z-index: 55; inset: 0; display: block; border: 0; background: rgba(25, 24, 22, .45); }
  .composition-header { align-items: stretch; flex-direction: column; }
  .composition-settings { flex-wrap: wrap; }
  :global(.cv-preview-slideover) { width: 100vw !important; }
  .preview-resize-handle, .preview-width-label { display: none; }
}

@media (max-width: 560px) {
  .workbench-header { position: static; }
  .workbench-identity { align-items: flex-start; }
  .workbench-title { max-width: 72vw; }
  .autosave-status { width: 100%; }
  .composition-canvas { padding: 1rem .75rem 2rem; }
  .composition-header h1 { font-size: 2.15rem; }
  .composition-section-header { align-items: stretch; flex-direction: column; }
  .composition-section-header > div, .composition-section-header > button { min-height: 2.5rem; }
  .selection-card :deep(> .sortable-composition-content) { align-items: stretch; flex-direction: column; }
  .composition-toolbar { align-items: stretch; flex-direction: column; margin-top: 0; }
  .preview-paper { min-width: 44rem; padding: .75rem; transform-origin: top left; }
}

@media (prefers-reduced-motion: reduce) {
  .block-library, .autosave-status .icon { animation: none; transition: none; }
}
</style>
