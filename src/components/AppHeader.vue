<script>
import CreateItem from "./CreateItem.vue";
</script>
<template>
  <div>
    <CreateItem :showModalProp="showModal" :itemsList="items" />
    <nav>
      <ul>
        <li><a href="https://nicbenson.com.au">⬅ Back to NicBenson.com.au</a></li>
      </ul>
      <ul>
        <li>List</li>
        <li>Table</li>
        <li><a href="#" @click="$emit('showCreateEvent')">Create Item +</a></li>
      </ul>
    </nav>
    <hgroup>
      <h1>Resume Builder</h1>
      <h3>Create a custom resume from your previously saved items</h3>
    </hgroup>
    <hr />
  </div>
</template>
