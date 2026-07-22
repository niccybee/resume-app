<script setup>
import OpenRouterSettings from "../../../../src/views/OpenRouterSettings.vue";

definePageMeta({
  layout: "workspace",
  middleware: "auth",
  title: "AI settings",
  description: "Connect OpenRouter without exposing provider secrets to the browser",
});
</script>

<template><OpenRouterSettings /></template>
