<script setup>
import PublicSiteHeader from "../components/PublicSiteHeader.vue";
</script>

<template>
  <div data-layout="public-site">
    <div class="container">
      <PublicSiteHeader />
    </div>
    <main class="container">
      <RouterView />
    </main>
  </div>
</template>
