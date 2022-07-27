<script setup>
import { defineProps } from "vue";

const props = defineProps({
  certificates: Array,
});
</script>

<template>
  <article>
    <h3>Certifications</h3>
    <div v-for="(c, i) in certificates">
      <hgroup>
        <h6>{{ c.name }}</h6>
        <p>
          <span>{{ c.issuer }}</span> <span>{{ c.date ? ` - ${c.date}` : "" }}</span>
        </p>
      </hgroup>
    </div>
  </article>
</template>
