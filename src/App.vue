<script setup>
import { ref } from "vue";
import AppHeader from "./components/AppHeader.vue";
</script>

<template>
  <div class="container"><AppHeader /></div>
  <main class="container">
    <Router-View />
  </main>
</template>

<style>
.cv-sidebar-content {
  font-size: 0.8rem !important;
}
.cv-sidebar-article {
  margin: 0.8rem 0 !important;
  padding-top: 0.8rem !important;
  padding-bottom: 0.2rem !important;
}
.cv-sidebar-header {
  margin-bottom: 1rem !important;
}
</style>
