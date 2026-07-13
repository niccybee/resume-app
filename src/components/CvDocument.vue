<script setup>
import { computed } from "vue";
import { resolveTheme } from "../domain/themes/themeRegistry";

const props = defineProps({ document: { type: Object, required: true } });
const theme = computed(() => resolveTheme(props.document.themeId));
const basics = computed(() => props.document.profile?.basics || {});
const bySection = computed(() =>
  Object.groupBy(props.document.selections || [], (item) => item.section),
);

function label(item) {
  const context = item.block?.contexts?.find((entry) => entry.type === "employment");
  return context?.label || item.block?.title || "Experience";
}

function value(item) {
  return item.content?.text || item.content?.name || item.content?.institution || "";
}
</script>

<template>
  <article class="cv-document" :class="`theme-${theme.id}`" :data-theme="theme.id">
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
          <article v-for="item in bySection.experience" :key="item.versionId" class="cv-entry">
            <h3>{{ label(item) }}</h3>
            <p>{{ value(item) }}</p>
          </article>
        </section>
      </main>
      <aside>
        <section
          v-for="section in ['skills', 'certifications', 'education', 'interests']"
          :key="section"
          v-show="bySection[section]?.length"
        >
          <h2>{{ section }}</h2>
          <ul>
            <li v-for="item in bySection[section]" :key="item.versionId">{{ value(item) }}</li>
          </ul>
        </section>
      </aside>
    </div>
  </article>
</template>

<style scoped>
.cv-document { --ink: #19221f; --accent: #345c4b; background: white; color: var(--ink); max-width: 210mm; min-height: 280mm; margin: 0 auto; padding: 18mm; border: 1px solid #d9dedb; box-shadow: 0 18px 50px rgba(22, 32, 28, .1); }
.cv-hero { display: flex; justify-content: space-between; gap: 2rem; padding-bottom: 1.5rem; border-bottom: 3px solid var(--accent); }
.cv-hero h1 { margin: 0; font-size: clamp(2.4rem, 7vw, 4.8rem); line-height: .9; letter-spacing: -.05em; }
.eyebrow { margin: 0 0 .7rem; color: var(--accent); font-weight: 700; letter-spacing: .14em; text-transform: uppercase; font-size: .72rem; }
.role { margin: .8rem 0 0; font-size: 1.15rem; }
address { display: grid; align-content: end; gap: .2rem; font-style: normal; text-align: right; font-size: .78rem; }
.cv-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(12rem, .8fr); gap: 2.4rem; margin-top: 2rem; }
h2 { color: var(--accent); text-transform: uppercase; letter-spacing: .08em; font-size: .8rem; margin-bottom: 1rem; }
h3 { font-size: 1rem; margin-bottom: .35rem; }
.cv-entry { padding: 0 0 1rem; margin: 0 0 1rem; border-bottom: 1px solid #dde2df; box-shadow: none; break-inside: avoid; }
.cv-entry p, .cv-document li, .cv-document main > section > p { font-size: .86rem; line-height: 1.6; }
.theme-modern { --ink: #14213d; --accent: #ef8354; font-family: ui-sans-serif, system-ui, sans-serif; border-radius: 22px; }
.theme-modern .cv-hero { background: #14213d; color: white; margin: -18mm -18mm 0; padding: 18mm; border: 0; }
.theme-modern .eyebrow, .theme-modern .cv-hero a { color: #ffb08f; }
@media (max-width: 700px) { .cv-document { min-height: 0; padding: 1.5rem; } .cv-hero, .cv-grid { grid-template-columns: 1fr; display: grid; } address { text-align: left; } .theme-modern .cv-hero { margin: -1.5rem -1.5rem 0; padding: 1.5rem; } }
@media print { .cv-document { min-height: 0; max-width: none; margin: 0; padding: 10mm; border: 0; box-shadow: none; print-color-adjust: exact; -webkit-print-color-adjust: exact; } .cv-entry, section { break-inside: avoid; } .cv-document a { color: inherit; text-decoration: underline; } }
</style>

