<script setup>
// This starter template is using Vue 3 <script setup> SFCs
// Check out https://vuejs.org/api/sfc-script-setup.html#script-setup

import AppHeader from "./components/AppHeader.vue";
import AppBody from "./components/AppBody.vue";
</script>

<template>
  <div class="container">
    <AppHeader />
    <Suspense>
      <AppBody />
      <template #fallback>
        <progress indeterminant></progress>
      </template>
    </Suspense>
  </div>
</template>

<style></style>
