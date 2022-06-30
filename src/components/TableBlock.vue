<script setup>
import { ref } from "vue";
const props = defineProps({ items: Array });
const headers = Object.keys(props.items[0]);
const showTable = ref(true);
</script>
<template>
  <h2>Table</h2>
  <button class="contrast" @click="showTable = !showTable">
    {{ showTable ? "- Hide Table" : "+ Show Table " }}
  </button>
  <table v-if="showTable">
    <thead>
      <th v-for="h in headers">{{ h }}</th>
    </thead>
    <tbody>
      <tr v-for="item in items">
        <td v-for="i in item">{{ i }}</td>
        <!-- <td><button role="button" class="secondary">+</button></td> -->
      </tr>
    </tbody>
  </table>
</template>
