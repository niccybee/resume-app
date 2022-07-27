<script setup>
import { defineProps } from "vue";

const props = defineProps({
  certificates: Array,
});
</script>

<template>
  <article class="cv-sidebar-article">
    <h4 class="cv-sidebar-header">Certifications</h4>
    <div v-for="(c, i) in certificates">
      <hgroup>
        <h6>{{ c.name }}</h6>
        <p class="cv-sidebar-content">
          <span>{{ c.issuer }}</span> <span>{{ c.date ? ` - ${c.date}` : "" }}</span>
        </p>
      </hgroup>
    </div>
  </article>
</template>
