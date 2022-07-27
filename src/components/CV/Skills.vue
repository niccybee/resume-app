<script setup>
const props = defineProps({
  skills: Array,
});
</script>
<template>
  <article id="skills">
    <h3>Skills</h3>
    <hgroup v-for="s in props.skills">
      <h6>{{ s.name }}:</h6>
      <span v-for="k in s.keywords">{{ k + ", " }}</span>
    </hgroup>
  </article>
</template>
