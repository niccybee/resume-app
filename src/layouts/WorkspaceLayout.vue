<script setup>
import AppHeader from "../components/AppHeader.vue";
</script>

<template>
  <div data-layout="workspace">
    <div class="container">
      <AppHeader />
    </div>
    <main class="container">
      <RouterView />
    </main>
  </div>
</template>
