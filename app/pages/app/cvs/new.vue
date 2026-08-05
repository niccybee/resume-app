<script setup>
import CvDraftEditor from "../../../../src/views/CvDraftEditor.vue";

definePageMeta({
  layout: "workspace",
  middleware: "auth",
  title: "New CV",
  description: "Compose a role-specific CV from exact Block Versions",
  flushContent: true,
});
</script>

<template><CvDraftEditor /></template>
