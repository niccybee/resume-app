<script setup>
import CvDraftEditor from "../../../../../src/views/CvDraftEditor.vue";

definePageMeta({
  layout: "workspace",
  middleware: "auth",
  title: "CV editor",
  description: "Edit content, theme, preview, and publication",
});
</script>

<template><CvDraftEditor /></template>
