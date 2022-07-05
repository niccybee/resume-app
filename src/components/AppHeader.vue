<script setup>
// import CreateItem from "./CreateItem.vue";
import { useSettingStore } from "../stores/appSettingsStore";

// // stores
const settings = useSettingStore();

function showCreateItemModal() {
  settings.showItemModal = true;
}
</script>
<template>
  <header>
    <nav>
      <ul>
        <li><a href="https://nicbenson.com.au">⬅ Back to NicBenson.com.au</a></li>
      </ul>
      <ul>
        <li>
          <a href="#" @click="settings.showCreateItemModal = true">Create Item +</a>
        </li>
      </ul>
    </nav>
    <hr />
    <hgroup>
      <h1>Resume Builder</h1>
      <h3>Create a custom resume from your previously saved items</h3>
    </hgroup>
  </header>
</template>
