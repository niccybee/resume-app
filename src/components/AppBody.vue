<script setup>
import List from "./List.vue";
import TableBlock from "./TableBlock.vue";
import CreateItem from "./CreateItem.vue";
import { ref } from "vue";
import { supabase } from "../supabase";
// vars
let items = ref([]);
let showCreate = ref(true);
const { data, error } = await supabase.from("CV_Items").select();
if (error) throw error;
items = data;
</script>

<template>
  <main>
    <CreateItem v-if="showCreate" :itemsList="items" />
    <List :listItems="items" />
    <TableBlock :items="items" />
  </main>
</template>
