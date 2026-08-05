<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { normalizeSlug } from "../domain/cvs/cvDraft";
import { resolveTheme } from "../domain/themes/themeRegistry";
import { cvWorkspace } from "../services/cvWorkspace";

const route = useRoute();
const router = useRouter();
const status = ref("loading");
const error = ref("");
const notice = ref("");
const cv = ref(null);
const revisions = ref([]);
const editingSessions = ref([]);
const publishSlug = ref("");
const proposal = ref(null);
const proposalOpen = ref(false);
const pending = ref("");

const openSessions = computed(() => editingSessions.value.filter((session) => session.status === "open"));
const publishedRevisionNumber = computed(() => revisions.value.find((revision) => revision.id === cv.value?.publishedRevisionId)?.number || null);

async function load() {
  status.value = "loading";
  error.value = "";
  try {
    const [document, history, sessions] = await Promise.all([
      cvWorkspace.open(route.params.cvId),
      cvWorkspace.history(route.params.cvId),
      cvWorkspace.editingSessions(route.params.cvId),
    ]);
    cv.value = document;
    revisions.value = history;
    editingSessions.value = sessions;
    publishSlug.value = document.slug || normalizeSlug(document.name);
    status.value = "loaded";
  } catch (reason) {
    error.value = reason.message;
    status.value = reason.code === "not-found" ? "missing" : "failed";
  }
}

async function resume(session) {
  await router.push(`/app/cvs/${cv.value.id}/edit?session=${session.id}`);
}

async function propose(operation) {
  if (pending.value) return;
  pending.value = operation.type;
  error.value = "";
  try {
    proposal.value = await cvWorkspace.proposeLifecycleChange({ operation });
    proposalOpen.value = true;
  } catch (reason) {
    error.value = reason.message;
  } finally {
    pending.value = "";
  }
}

function proposeStart(revision = null) {
  return propose({
    type: "start_editing_session",
    target: { type: "cv", id: cv.value.id },
    baseRevisionId: revision?.id || null,
  });
}

function proposePublish(revision) {
  return propose({
    type: "publish_revision",
    target: { type: "cv_revision", id: revision.id, cvId: cv.value.id },
    slug: publishSlug.value,
  });
}

async function applyProposal() {
  if (!proposal.value || pending.value) return;
  const operationType = proposal.value.operationType;
  pending.value = "apply";
  try {
    const applied = await cvWorkspace.applyChangeProposal(proposal.value.id);
    proposal.value = null;
    proposalOpen.value = false;
    if (operationType === "start_editing_session") {
      await router.push(`/app/cvs/${cv.value.id}/edit?session=${applied.result.editingSessionId}`);
      return;
    }
    notice.value = "Change Proposal applied.";
    await load();
  } catch (reason) {
    error.value = reason.message;
  } finally {
    pending.value = "";
  }
}

async function discardProposal() {
  if (!proposal.value || pending.value) return;
  pending.value = "discard";
  try {
    await cvWorkspace.discardChangeProposal(proposal.value.id);
    proposal.value = null;
    proposalOpen.value = false;
    notice.value = "Change Proposal discarded.";
  } catch (reason) {
    error.value = reason.message;
  } finally {
    pending.value = "";
  }
}

function publicationLabel(revision) {
  if (revision.id === cv.value.publishedRevisionId) return "Published Revision";
  if (publishedRevisionNumber.value && revision.number < publishedRevisionNumber.value) return `Roll back to Revision ${revision.number}`;
  return `Publish Revision ${revision.number}`;
}

onMounted(load);
</script>

<template>
  <p v-if="status === 'loading'" aria-busy="true">Loading CV overview…</p>
  <section v-else-if="status === 'missing'"><h1>CV not found</h1><NuxtLink to="/app/cvs">Return to saved CVs</NuxtLink></section>
  <div v-else-if="status === 'failed'" role="alert">{{ error }}</div>
  <main v-else class="cv-overview">
    <header class="overview-hero">
      <div>
        <p class="overview-eyebrow">CV overview · {{ cv.status }}</p>
        <h1>{{ cv.name }}</h1>
        <p>{{ cv.profile?.basics?.label || "No target role" }} · {{ resolveTheme(cv.themeId).name }} theme</p>
      </div>
      <div class="overview-actions">
        <UButton v-if="openSessions.length" icon="i-lucide-file-pen-line" @click="resume(openSessions[0])">Resume Workbench</UButton>
        <UButton v-else-if="cv.status !== 'archived'" icon="i-lucide-file-plus-2" @click="proposeStart(revisions[0] || null)">Start Editing Session</UButton>
        <NuxtLink role="button" class="secondary control-standard" :to="`/app/cvs/${cv.id}/preview`">A4 print preview</NuxtLink>
      </div>
    </header>

    <div v-if="error" class="overview-message overview-message--error" role="alert">{{ error }}</div>
    <p v-if="notice" class="overview-message" role="status">{{ notice }}</p>

    <div class="overview-grid">
      <section class="overview-panel" aria-labelledby="sessions-title">
        <header><p class="overview-eyebrow">Working state</p><h2 id="sessions-title">Editing Sessions</h2></header>
        <p v-if="!openSessions.length">No open Editing Sessions.</p>
        <article v-for="session in openSessions" :key="session.id" class="overview-row">
          <div><strong>{{ session.baseRevisionNumber ? `Based on Revision ${session.baseRevisionNumber}` : "Initial Editing Session" }}</strong><span>Working version {{ session.optimisticVersion }}</span></div>
          <UButton color="neutral" variant="outline" @click="resume(session)">Resume</UButton>
        </article>
      </section>

      <section class="overview-panel" aria-labelledby="publication-title">
        <header><p class="overview-eyebrow">Public lifecycle</p><h2 id="publication-title">Publishing</h2></header>
        <UFormField label="Stable public slug"><UInput v-model="publishSlug" :disabled="Boolean(cv.slug)" class="w-full" /></UFormField>
        <p v-if="cv.status === 'published'">Revision {{ publishedRevisionNumber }} is live at <NuxtLink :to="`/cv/${cv.slug}`" target="_blank">/cv/{{ cv.slug }}</NuxtLink>.</p>
        <p v-else>Select an exact immutable Revision below to publish.</p>
        <UButton v-if="cv.status === 'published'" color="neutral" variant="outline" :loading="pending === 'withdraw_publication'" @click="propose({ type: 'withdraw_publication', target: { type: 'cv', id: cv.id } })">Withdraw publication</UButton>
      </section>
    </div>

    <section class="overview-panel revision-history" aria-labelledby="revisions-title">
      <header><p class="overview-eyebrow">Immutable history</p><h2 id="revisions-title">CV Revisions</h2></header>
      <p v-if="!revisions.length">No immutable CV Revisions yet. Finish an Editing Session to create the first one.</p>
      <ol v-else>
        <li v-for="revision in revisions" :key="revision.id" class="overview-row">
          <div><strong>Revision {{ revision.number }}</strong><span v-if="revision.baseRevisionNumber">Based on Revision {{ revision.baseRevisionNumber }}</span><span v-else>Original Revision</span></div>
          <div class="revision-actions">
            <UButton v-if="cv.status !== 'archived'" color="neutral" variant="outline" @click="proposeStart(revision)">Start from Revision {{ revision.number }}</UButton>
            <UButton v-if="cv.status !== 'archived'" :disabled="revision.id === cv.publishedRevisionId || !publishSlug.trim()" @click="proposePublish(revision)">{{ publicationLabel(revision) }}</UButton>
          </div>
        </li>
      </ol>
    </section>

    <footer class="overview-danger-zone">
      <UButton v-if="cv.status !== 'archived'" color="error" variant="outline" @click="propose({ type: 'archive_cv', target: { type: 'cv', id: cv.id } })">Archive CV…</UButton>
      <UButton v-else color="neutral" variant="outline" @click="propose({ type: 'restore_cv', target: { type: 'cv', id: cv.id } })">Restore CV</UButton>
    </footer>

    <UModal v-model:open="proposalOpen" title="Review Change Proposal" description="Nothing changes until you apply this proposal." scrollable :ui="{ content: 'sm:max-w-3xl', footer: 'justify-end' }">
      <template #body><article v-if="proposal" class="proposal-review"><p>Operation: {{ proposal.operationType }}</p><p>Target: {{ proposal.target?.id }}</p><pre>{{ JSON.stringify(proposal.diff || proposal.operations, null, 2) }}</pre><p v-if="proposal.warnings?.length">Warnings: {{ proposal.warnings.join(" · ") }}</p><p v-else>No warnings.</p></article></template>
      <template #footer><UButton color="neutral" variant="outline" :loading="pending === 'discard'" :disabled="Boolean(pending)" @click="discardProposal">Discard</UButton><UButton :loading="pending === 'apply'" :disabled="Boolean(pending)" @click="applyProposal">Apply Proposed Changes</UButton></template>
    </UModal>
  </main>
</template>

<style scoped>
.cv-overview { max-width: 76rem; margin: 0 auto; }
.overview-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 2rem; padding: 2rem 0; border-bottom: 2px solid var(--ink); }
.overview-hero h1 { margin: .25rem 0; font-family: var(--font-editorial); font-size: clamp(2.8rem, 7vw, 5.5rem); font-weight: 400; line-height: .9; }
.overview-hero p { margin: .35rem 0 0; color: var(--muted); }
.overview-eyebrow { margin: 0 !important; color: var(--marker-dark) !important; font-family: var(--font-label); font-size: .65rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
.overview-actions, .revision-actions { display: flex; flex-wrap: wrap; gap: .55rem; }
.overview-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem; margin: 1.5rem 0; }
.overview-panel { padding: 1.25rem; border: 1px solid var(--ink); background: var(--paper-light); box-shadow: 5px 5px 0 var(--paper-deep); }
.overview-panel h2 { margin: .2rem 0 1rem; font-family: var(--font-editorial); font-size: 2rem; font-weight: 400; }
.overview-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .85rem 0; border-top: 1px solid var(--paper-deep); }
.overview-row strong, .overview-row span { display: block; }
.overview-row span { margin-top: .15rem; color: var(--muted); font-size: .75rem; }
.revision-history { margin-bottom: 1.5rem; }
.revision-history ol { margin: 0; padding: 0; list-style: none; }
.overview-message { padding: .7rem 1rem; border: 1px solid var(--ink); background: var(--paper-light); }
.overview-message--error { background: #fff0ed; color: #8f221b; }
.overview-danger-zone { display: flex; justify-content: flex-end; padding: 1rem 0 3rem; }
.proposal-review pre { max-height: 24rem; overflow: auto; padding: 1rem; background: var(--ink); color: var(--paper-light); font-size: .72rem; }
@media (max-width: 760px) { .overview-hero, .overview-row { align-items: stretch; flex-direction: column; } .overview-grid { grid-template-columns: 1fr; } }
</style>
