<script setup>
definePageMeta({
  layout: "workspace",
  middleware: "auth",
  title: "Workspace page not found",
});
</script>

<template>
  <section>
    <p>The requested workspace page does not exist.</p>
    <NuxtLink to="/app/cvs">Return to saved CVs</NuxtLink>
  </section>
</template>
