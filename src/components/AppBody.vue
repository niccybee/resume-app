<script setup>
import List from "./List.vue";
import Builder from "./Builder.vue";
import TableBlock from "./TableBlock.vue";
import SearchBar from "./SearchBar.vue";
import Filter from "./Filter.vue";
import CreateItem from "./CreateItem.vue";
// import Builder from "./Builder.vue";
import { useItemsStore } from "../stores/itemStore";
import { useSettingStore } from "../stores/appSettingsStore";

// TODO: change settingsStore to plural

// stores
const settings = useSettingStore();
const store = useItemsStore();
store.getItems();
</script>

<template>
  <main>
    <CreateItem />
    <SearchBar />
    <Filter />
    <Builder :selectedItems="store.addedItems" />
    <List :listItems="store.items" v-if="settings.showListNotTable" />
    <TableBlock :items="store.items" v-else />
    <!-- <Builder /> -->
  </main>
</template>
