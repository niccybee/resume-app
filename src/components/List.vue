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
function employerSelected(employer) {
  console.log("employer selected: ", employer);
}
function employers() {
  let employerList = props.listItems.map((a) => a.employer);
  return [...new Set(employerList)];
}
// Add items functions
function addItem(resumeItem) {
  console.log("caught it!");
  // addedItems.value.push(resumeItem);
}
</script>
<template>
  <h2>CV Items</h2>
  <Builder @addToResume="addItem" />
  <input
    placeholder="Search"
    @input=""
    type="text"
    name="search"
    id=""
    v-model="searchInput"
  />

  <button class="contrast" @click="showList = !showList">
    {{ showList ? "- Hide List" : "+ Show List " }}
  </button>
  <div v-if="showList" class="grid">
    <div><Item v-for="i in filtered()" :key="i.id" :item="i" /></div>
  </div>
</template>
