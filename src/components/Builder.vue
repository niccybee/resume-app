<script setup>
import { ref } from "vue";
const props = defineProps({
  selectedItems: Array,
});
const addedItems = ref([]);
const showBuilder = ref(true);

function addItem(item) {
  console.log("caught it!");
  addedItems.value.push(item);
}
</script>
<template>
  <article class="card builder" @addToResume="addItem(item)">
    <a href="#" role="button" class="secondary" @click="showBuilder = !showBuilder">
      {{ showBuilder ? "-" : "+" }}
    </a>
    <div>
      <div v-if="showBuilder">
        <header><h2>Active List</h2></header>
        <figure>
          <h4>Included:</h4>
          <article v-for="item in addedItems">{{ item }}</article>
        </figure>
        <footer>
          <button>Upload Resume</button>
          <button class="contrast">Clear Resume</button>
        </footer>
      </div>
    </div>
  </article>
</template>
<style>
.builder {
  position: fixed;
  right: 0;
  bottom: 0;
  max-width: 33%;
}
@media only screen and (max-width: 600px) {
  .builder {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
  }
}
</style>
