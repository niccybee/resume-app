<script setup>
import { ref } from "vue";
import { useItemsStore } from "../stores/itemStore";
const items = useItemsStore();
const showTable = ref(true);
</script>
<template>
  <!-- <button class="contrast" @click="showTable = !showTable">
    {{ showTable ? "- Hide Table" : "+ Show Table " }}
  </button> -->
  <table v-if="showTable">
    <thead>
      <th v-for="h in items.headers">{{ h }}</th>
    </thead>
    <tbody>
      <tr v-for="item in items.searchItems">
        <td v-for="i in item">{{ i }}</td>
        <td>
          <button role="button" class="secondary" @click="items.addItemToBuilder(item)">
            <span>+</span>
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</template>
