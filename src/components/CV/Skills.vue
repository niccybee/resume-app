<script setup>
const props = defineProps({
  skills: Array,
});
</script>
<template>
  <article class="cv-sidebar-article" id="skills">
    <h4 class="cv-sidebar-header">Skills</h4>
    <hgroup v-for="s in props.skills">
      <h6>{{ s.name }}:</h6>
      <span class="cv-sidebar-content" v-for="k in s.keywords">{{ k + ", " }}</span>
      <!-- TODO: Amend this hacky CSS Specificty fix -->
      <span></span>
    </hgroup>
  </article>
</template>
