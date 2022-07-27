<script setup>
const props = defineProps({
  education: Array,
});
</script>
<template>
  <article id="skills" class="cv-sidebar-article">
    <h4 class="cv-sidebar-header">Education</h4>
    <hgroup v-for="e in props.education">
      <h6>{{ e.institution }}</h6>
      <p class="cv-sidebar-content">
        <span class="date">{{ `${e.startDate} - ${e.endDate}` }}</span>
        <br /><span>{{ e.area }}</span>
      </p>

      <!-- TODO: Amend this hacky CSS Specificty fix -->
      <span></span>
    </hgroup>
  </article>
</template>
<style scoped>
.date {
  color: var(--muted-color);
  font-size: 0.6rem;
}
</style>
