<script setup>
import List from "./List.vue";
import TableBlock from "./TableBlock.vue";

import { ref } from "vue";
import { supabase } from "../supabase";
// props

// vars
let items = ref([]);
const { data, error } = await supabase.from("CV_Items").select();
if (error) throw error;
items = data;
</script>

<template>
  <main>
    <List :listItems="items" />
    <TableBlock :items="items" />
  </main>
</template>
