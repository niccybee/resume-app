<script setup>
import { defineProps } from "vue";

const props = defineProps({
  languages: Array,
});
</script>
<template>
  <article class="cv-sidebar-article">
    <hgroup>
      <h4 class="cv-sidebar-header">Languages</h4>
      <p class="cv-sidebar-content" v-for="l in props.languages">
        {{ l.language }}: {{ l.fluency }}
      </p>
    </hgroup>
  </article>
</template>
