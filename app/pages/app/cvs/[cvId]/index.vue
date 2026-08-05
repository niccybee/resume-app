<script setup>
import CvOverview from "../../../../../src/views/CvOverview.vue";

definePageMeta({
  layout: "workspace",
  middleware: "auth",
  title: "CV overview",
  description: "Review CV Revisions, Editing Sessions, and publication",
});
</script>

<template><CvOverview /></template>
