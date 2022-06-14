<script setup>
import { ref, computed } from "vue";
import Item from "./Item.vue";
import Builder from "./Builder.vue";
// import SearchBar from "./SearchBar.vue";
// Initial Vars
const props = defineProps(["listItems"]);
const showList = ref(true);

// Search Vars
let searchInput = ref("");

// Builder Vars
let addedItems = ref([]);
// Search functions
function filtered() {
  let filteredItems = props.listItems;
  return filteredItems.filter(
    (i) =>
      i.item.toLowerCase().includes(searchInput.value) ||
      i.role.toLowerCase().includes(searchInput.value) ||
      i.employer.toLowerCase().includes(searchInput.value)
  );
}

// Add items functions
function initAddedItems() {
  console.log("init", addedItems);
  addedItems.map((i) => i);
}
function addItem(resumeItem) {
  addedItems.value.push(resumeItem);
}
</script>
<template>
  <h2>List</h2>
  <Builder :selectedItems="addedItems" />
  <input
    placeholder="Search"
    @input=""
    type="search"
    name="search"
    id=""
    v-model="searchInput"
  />

  <button class="contrast" @click="showList = !showList">
    {{ showList ? "- Hide List" : "+ Show List " }}
  </button>
  <div v-if="showList" class="grid">
    <div>
      <Item v-for="i in filtered()" :key="i.id" :item="i" @addToResume="addItem" />
    </div>
  </div>
</template>
