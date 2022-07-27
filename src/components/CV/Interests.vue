<script setup>
import { defineProps } from "vue";

const props = defineProps({
  interests: Array,
});
</script>
<template>
  <article class="cv-sidebar-article">
    <h4 class="cv-sidebar-header">Interests</h4>
    <hgroup v-for="i in props.interests">
      <h6>{{ i.name }}</h6>
      <p class="cv-sidebar-content">
        <span v-for="k in i.keywords">{{ k ? `${k}, ` : "" }} </span>
      </p>
    </hgroup>
    <!-- I am the {{ props.interests }} -->
  </article>
</template>
