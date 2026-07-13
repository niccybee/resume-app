<script setup>
import { useRoute } from "vue-router";

const route = useRoute();
</script>

<template>
  <header id="workspace-header" data-workspace-navigation>
    <nav>
      <ul>
        <li><strong>Resume workspace</strong></li>
      </ul>
      <ul>
        <li><RouterLink data-nav="cvs" to="/app/cvs">Saved CVs</RouterLink></li>
        <li><RouterLink data-nav="blocks" to="/app/blocks">Blocks</RouterLink></li>
        <li><RouterLink data-nav="builder" to="/app/builder">Builder</RouterLink></li>
      </ul>
    </nav>
    <hr />
    <hgroup>
      <h1>{{ route.meta.title }}</h1>
      <p v-if="route.meta.description">{{ route.meta.description }}</p>
    </hgroup>
  </header>
</template>

<style>
@media print {
  #workspace-header {
    display: none;
  }
}
</style>
