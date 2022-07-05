<script setup>
import { ref } from "vue";
import AppHeader from "./components/AppHeader.vue";
import AppBody from "./components/AppBody.vue";

const showCreateBox = ref(false);
let handleShowCreate = () => {
  console.log("caught create show event");
  showCreateBox.value = true;
};
let showT;
</script>

<template>
  <div class="container">
    <AppHeader @showCreateEvent="handleShowCreate" />
    <AppBody :createItemModal="showCreateBox" />
  </div>
</template>

<style></style>
