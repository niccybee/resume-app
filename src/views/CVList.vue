<script setup>
import { computed, onMounted, ref } from "vue";
import { resolveTheme } from "../domain/themes/themeRegistry";
import { cvWorkspace } from "../services/cvWorkspace";

const cvs = ref([]);
const status = ref("loading");
const error = ref("");
const activeCvs = computed(() => cvs.value.filter((cv) => cv.status !== "archived"));
const archivedCvs = computed(() => cvs.value.filter((cv) => cv.status === "archived"));

async function load() {
  status.value = "loading";
  error.value = "";
  try {
    cvs.value = await cvWorkspace.list();
    status.value = cvs.value.length ? "loaded" : "empty";
  } catch (reason) {
    error.value = reason.message;
    status.value = "failed";
  }
}

onMounted(load);
</script>

<template>
  <div class="cv-index-toolbar">
    <div>
      <p class="eyebrow">CV lineages / {{ activeCvs.length.toString().padStart(2, "0") }}</p>
      <p>Each card is a role-focused CV with its own immutable Revision history.</p>
    </div>
    <NuxtLink class="primary-control" role="button" to="/app/cvs/new">Create CV</NuxtLink>
  </div>

  <p v-if="status === 'loading'" class="loading-state" aria-busy="true">Loading saved CVs…</p>
  <section v-else-if="status === 'empty'" class="empty-state">
    <span class="empty-folio" aria-hidden="true">01</span>
    <p class="eyebrow">Blank working set</p>
    <h2>No saved CVs yet</h2>
    <p>Create a role-focused CV from your CV Blocks.</p>
    <NuxtLink class="primary-control" role="button" to="/app/cvs/new">Create the first CV</NuxtLink>
  </section>
  <div v-else-if="status === 'failed'" class="error-state" role="alert">
    <p>{{ error }}</p>
    <button class="secondary" @click="load">Try again</button>
  </div>

  <template v-else>
    <section class="cv-list">
      <article v-for="(cv, index) in activeCvs" :key="cv.id" class="cv-sheet">
        <header>
          <p class="status">{{ cv.status }}</p>
          <span aria-hidden="true">{{ String(index + 1).padStart(2, "0") }}</span>
        </header>
        <h2>{{ cv.name }}</h2>
        <p>{{ resolveTheme(cv.themeId).name }} theme</p>
        <footer>
          <NuxtLink :to="`/app/cvs/${cv.id}`">Open overview</NuxtLink>
          <NuxtLink :to="`/app/cvs/${cv.id}/edit`">Edit CV</NuxtLink>
          <NuxtLink :to="`/app/cvs/${cv.id}/preview`">A4 print preview</NuxtLink>
          <NuxtLink v-if="cv.status === 'published'" :to="`/cv/${cv.slug}`">Public link</NuxtLink>
        </footer>
      </article>
    </section>

    <details v-if="archivedCvs.length" class="archived-cvs">
      <summary>Archived CVs ({{ archivedCvs.length }})</summary>
      <section class="cv-list">
        <article v-for="cv in archivedCvs" :key="cv.id" class="cv-sheet archived">
          <p class="status">Archived</p>
          <h2>{{ cv.name }}</h2>
          <footer>
            <NuxtLink :to="`/app/cvs/${cv.id}`">Review archived CV</NuxtLink>
          </footer>
        </article>
      </section>
    </details>
  </template>
</template>

<style scoped>
.cv-index-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  margin-bottom: 2rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--ink);
}

.cv-index-toolbar p {
  margin: 0;
}

.primary-control {
  flex: 0 0 auto;
}

.loading-state,
.error-state {
  padding: 2rem;
  border: 1px solid var(--ink);
  background: var(--paper-light);
}

.empty-state {
  position: relative;
  max-width: 48rem;
  margin: 6vh auto;
  padding: clamp(2rem, 6vw, 5rem);
  border: 2px solid var(--ink);
  background: var(--paper-light);
  box-shadow: 10px 10px 0 var(--paper-deep), 12px 12px 0 var(--ink);
  text-align: left;
}

.empty-state h2 {
  max-width: 28rem;
  margin: 0.35rem 0;
  font-size: clamp(2.6rem, 6vw, 4.8rem);
  font-weight: 400;
  line-height: 0.95;
  letter-spacing: -0.05em;
}

.empty-folio {
  position: absolute;
  top: 1rem;
  right: 1rem;
  font-family: var(--font-label);
  font-size: 0.68rem;
}

.cv-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.25rem;
}

.cv-sheet {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 15rem;
  border: 2px solid var(--ink) !important;
  background: var(--paper-light);
  box-shadow: 6px 6px 0 var(--paper-deep);
}

.cv-sheet::after {
  position: absolute;
  right: 1rem;
  bottom: 1rem;
  width: 2.5rem;
  height: 0.4rem;
  background: var(--marker);
  content: "";
}

.cv-sheet header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--paper-deep);
}

.cv-sheet header span,
.status {
  font-family: var(--font-label);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.status {
  color: var(--success);
}

.cv-sheet h2 {
  margin: 1.5rem 0 0.4rem;
  font-size: 1.8rem;
  font-weight: 400;
}

.cv-sheet footer {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: auto;
  padding-top: 0.8rem;
  border-top: 1px solid var(--ink);
  font-size: 0.82rem;
  font-weight: 700;
}

.cv-sheet.archived {
  opacity: 0.72;
}

.archived-cvs {
  margin-top: 2rem !important;
}

@media (max-width: 600px) {
  .cv-index-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .primary-control {
    width: 100% !important;
  }
}
</style>
