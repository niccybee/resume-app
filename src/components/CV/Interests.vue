<script setup>
import { defineProps } from "vue";

const props = defineProps({
  interests: Array,
});
</script>
<template>
  <article>
    <h3>Interests</h3>
    <hgroup v-for="i in props.interests">
      <h6>{{ i.name }}</h6>
      <p>
        <span v-for="k in i.keywords">{{ k ? `${k}, ` : "" }} </span>
      </p>
    </hgroup>
    <!-- I am the {{ props.interests }} -->
  </article>
</template>
