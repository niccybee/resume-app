<script setup>
import CvDraftEditor from "../../../../../src/views/CvDraftEditor.vue";

definePageMeta({
  layout: "workspace",
  middleware: "auth",
  title: "CV Workbench",
  description: "Compose a role-focused CV from exact Block Versions",
  flushContent: true,
});
</script>

<template><CvDraftEditor /></template>
