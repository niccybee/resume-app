<script setup>
import CvPreview from "../../../../../src/views/CvPreview.vue";

definePageMeta({
  layout: "workspace",
  middleware: "auth",
  title: "Private preview",
});
</script>

<template><CvPreview /></template>
