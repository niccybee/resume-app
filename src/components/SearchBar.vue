<script setup>
import { useItemsStore } from "../stores/itemStore";
import { useSettingStore } from "../stores/appSettingsStore";
const items = useItemsStore();
const settings = useSettingStore();

function showListView() {
  settings.showListNotTable = true;
}

function showTableView() {
  settings.showListNotTable = false;
}
</script>

<template>
  <div>
    <nav>
      <ul></ul>
      <ul>
        <li><a @click="showListView">List</a></li>
        <li><a @click="showTableView">Table</a></li>
      </ul>
    </nav>
    <input
      placeholder="Search"
      type="search"
      name="search"
      id=""
      v-model="items.searchInput"
    />
  </div>
</template>
