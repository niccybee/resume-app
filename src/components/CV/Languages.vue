<script setup>
import { defineProps } from "vue";

const props = defineProps({
  languages: Array,
});
</script>
<template>
  <article>
    <hgroup>
      <h3>Languages</h3>
      <p v-for="l in props.languages">{{ l.language }}: {{ l.fluency }}</p>
    </hgroup>
  </article>
</template>
