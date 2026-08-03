<script setup>
import CvPreview from "../../../../../src/views/CvPreview.vue";

definePageMeta({
  layout: "workspace",
  middleware: "auth",
  title: "A4 print preview",
  compactHeaderOnMobile: true,
});
</script>

<template><CvPreview /></template>
