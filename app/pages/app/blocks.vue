<script setup>
import BlockLibraryView from "../../../src/views/BlockLibraryView.vue";

definePageMeta({
  layout: "workspace",
  middleware: "auth",
  title: "Reusable blocks",
  description: "Find and select previously saved CV content",
});
</script>

<template><BlockLibraryView /></template>
