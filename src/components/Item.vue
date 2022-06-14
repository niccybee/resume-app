<script setup>
import { defineProps } from "vue";
defineProps(["item"]);
</script>
<template>
  <article>
    <!-- <hgroup> -->
    <h4>{{ item.employer }}</h4>
    <h5>{{ item.role }}</h5>
    <!-- </hgroup> -->
    <p>{{ item.item }}</p>
    <button href="#" @click="$emit('addToResume', item)" role="button" class="secondary">
      +
    </button>
  </article>
</template>
