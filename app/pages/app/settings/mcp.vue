<script setup>
import McpSettings from "../../../../src/views/McpSettings.vue";

definePageMeta({
  layout: "workspace",
  middleware: "auth",
  title: "MCP settings",
  description: "Connect Resume Studio to ChatGPT, OpenCode, and other OAuth-capable clients",
});
</script>

<template><McpSettings /></template>
