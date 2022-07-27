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

<style></style>
