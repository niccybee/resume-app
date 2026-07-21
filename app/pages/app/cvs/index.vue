<script setup>
import CVList from "../../../../src/views/CVList.vue";

definePageMeta({
  layout: "workspace",
  middleware: "auth",
  title: "Saved CVs",
});
</script>

<template><CVList /></template>
