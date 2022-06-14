<script setup>
import { ref, onMounted } from "vue";

const props = defineProps({
  data: Array,
  array1: String,
  array2: String,
});
const emit = defineEmits(["initSearch", "searchInput"]);
let searchText = ref("");

onMounted(() => {
  emit("initSearch");
}),
  function filteredResults() {
    let data = props.data;
    console.log(data);
    let filtered = data.filter((i) => {
      if (searchText.length >= 1) {
        return data;
      } else if (props.array1 && props.array2) {
        console.log("from - filter: ", i[props.array1]);
        i[props.array1].toLowerCase().includes(searchText.value.toLowerCase()) ||
          i[props.array2].toLowerCase().includes(searchText.value.toLowerCase());
      } else {
        console.log("need to add arrays");
      }
    });
    console.log("filtered results should be: ", filtered);
    return filtered;
  };

// let searchInput = ref("");
// function filtered() {
//   return props.listItems.filter(
//     (i) =>
//       i.item.toLowerCase().includes(searchInput.value) ||
//       i.employer.toLowerCase().includes(searchInput.value)
//   );
// }

const handleInput = (params) => {
  emit("searchInput", filteredResults());
};
</script>

<template>
  <!--For Parent Component
       <SearchBar
    :data="listItems"
    @searchInput="handleSearch"
    @initSearch="pushResults"
    array1="item"
    array2="employer"
  /> -->
  <div>
    <sub>SEARCH:</sub>
    <input
      placeholder="Search"
      @input="handleInput"
      type="text"
      name="search"
      id=""
      v-model="searchText"
    />
  </div>
  <!-- <p>{{ filteredResults() }}</p> -->
  <p>{{ searchText || "type..." }}</p>
  <p>{{ props.array1 }}</p>
  <p>{{ props.array2 }}</p>
  <p v-for="d in filteredResults()">{{ d.id }} - {{ d.item }}</p>
  <!-- <p v-for="d in data">{{ d.id }} - {{ d.item }}</p> -->
</template>
