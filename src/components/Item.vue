<script setup>
defineProps(["item"]);
</script>
<template>
  <article>
    <hgroup>
      <h4>{{ item.employer }}</h4>
      <h5>{{ item.role }}</h5>
      <p><small>{{ item.period }}</small></p>
    </hgroup>
    <p>{{ item.item }}</p>
    <button href="#" @click="$emit('addToResume', item)" role="button" class="secondary control-icon" aria-label="Add item to draft">
      +
    </button>
  </article>
</template>
