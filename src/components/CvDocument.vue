<script setup>
import { computed } from "vue";
import { groupExperienceSelections } from "../domain/cvs/cvDraft";
import { formatEmploymentPeriod } from "../domain/employment/occasion";
import { resolveTheme } from "../domain/themes/themeRegistry";

const props = defineProps({
  document: { type: Object, required: true },
  paperSize: {
    type: String,
    default: null,
    validator: (value) => value === null || value === "A4",
  },
});
const theme = computed(() => resolveTheme(props.document.themeId));
const isA4 = computed(() => props.paperSize === "A4");
const basics = computed(() => props.document.profile?.basics || {});
const bySection = computed(() =>
  Object.groupBy(props.document.selections || [], (item) => item.section),
);
const experienceGroups = computed(() => groupExperienceSelections(bySection.value.experience));

function value(item) {
  return item.content?.text || item.content?.name || item.content?.institution || "";
}

function sectionLabel(section) {
  return `${section.charAt(0).toUpperCase()}${section.slice(1)}`;
}
</script>

<template>
  <article
    class="cv-document"
    :class="[`theme-${theme.id}`, { 'cv-document--a4': isA4 }]"
    :data-theme="theme.id"
    :data-paper-size="isA4 ? 'A4' : undefined"
  >
    <header class="cv-hero">
      <div>
        <p class="eyebrow">Curriculum vitae</p>
        <h1>{{ basics.name || document.name }}</h1>
        <p class="role">{{ basics.label }}</p>
      </div>
      <address>
        <a v-if="basics.email" :href="`mailto:${basics.email}`">{{ basics.email }}</a>
        <a v-if="basics.phone" :href="`tel:${basics.phone}`">{{ basics.phone }}</a>
        <a v-if="basics.url" :href="basics.url">{{ basics.url }}</a>
      </address>
    </header>

    <div class="cv-grid">
      <main>
        <section v-if="document.summary || basics.summary">
          <h2>Profile</h2>
          <p>{{ document.summary || basics.summary }}</p>
        </section>
        <section v-if="bySection.experience?.length">
          <h2>Experience</h2>
          <article v-for="employer in experienceGroups" :key="employer.employerId" class="cv-employer">
            <h3>{{ employer.employer }}</h3>
            <section v-for="occasion in employer.occasions" :key="occasion.occasionId" class="cv-role cv-occasion">
              <div class="cv-occasion-heading">
                <h4>{{ occasion.role }}</h4>
                <p class="cv-period">{{ formatEmploymentPeriod(occasion.startDate, occasion.endDate) }}</p>
              </div>
              <ul>
                <li v-for="item in occasion.items" :key="item.versionId" class="cv-achievement cv-entry">
                  {{ value(item) }}
                </li>
              </ul>
            </section>
          </article>
        </section>
      </main>
      <aside>
        <section
          v-for="section in ['skills', 'certifications', 'education', 'interests']"
          :key="section"
          v-show="bySection[section]?.length"
        >
          <h2>{{ sectionLabel(section) }}</h2>
          <ul>
            <li v-for="item in bySection[section]" :key="item.versionId">{{ value(item) }}</li>
          </ul>
        </section>
      </aside>
    </div>
  </article>
</template>

<style scoped src="./cv-document/base.css"></style>
<style scoped src="./cv-document/editorial.css"></style>
<style scoped src="./cv-document/modern.css"></style>
<style scoped src="./cv-document/jsonresume-even.css"></style>
<style scoped src="./cv-document/jsonresume-actual.css"></style>
<style scoped src="./cv-document/jsonresume-class.css"></style>
<style scoped src="./cv-document/magazine-folio.css"></style>
<style scoped src="./cv-document/magazine-basel.css"></style>
<style scoped src="./cv-document/magazine-gallery.css"></style>
<style scoped src="./cv-document/magazine-dispatch.css"></style>
<style scoped src="./cv-document/magazine-atelier.css"></style>
