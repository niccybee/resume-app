<script setup>
import { ref } from "vue";
import { useItemsStore } from "../stores/itemStore";
import { useSettingStore } from "../stores/appSettingsStore";

const items = useItemsStore();
const settings = useSettingStore();
</script>
<template>
  <select role="listbox" v-if="settings.showFilter">
    <option value="" disabled selected>Select</option>
    <option value="" selected>None</option>
    <option v-for="e in items.employers">
      {{ e }}
    </option>
  </select>
</template>
