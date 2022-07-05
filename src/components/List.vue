<script setup>
import { ref, computed } from "vue";
import { useItemsStore } from "../stores/itemStore";
import Item from "./Item.vue";
import Builder from "./Builder.vue";
// import SearchBar from "./SearchBar.vue";
// Initial Vars
const items = useItemsStore();
const showList = ref(true);
</script>
<template>
  <div v-if="showList" class="grid">
    <div>
      <Item
        v-for="i in items.searchItems"
        :key="i.id"
        :item="i"
        @addToResume="items.addItemToBuilder(i)"
      />
    </div>
  </div>
</template>
