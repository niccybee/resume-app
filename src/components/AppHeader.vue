<script setup>
// import CreateItem from "./CreateItem.vue";
import { useSettingStore } from "../stores/appSettingsStore";
// import { useRoute } from "vue-router";
// const route = useRoute();

// // stores
const settings = useSettingStore();

function showCreateItemModal() {
  settings.showItemModal = true;
}
</script>
<template>
  <header id="site-header">
    <nav>
      <ul>
        <li><a href="https://nicbenson.com.au">⬅ Back to NicBenson.com.au</a></li>
      </ul>
      <ul>
        <li>Use File > Print > Save to PDF to download</li>
        <li>
          <!-- TODO: Fix this crazy naming convention -->
          <!-- TODO: Figure out the URL schema: 

        Currently I'm thinking /cv/[resume-name]
        and then cv.nicbenson.com.au for the standard.

        

          Home:     https://nicbenson.com.au/cv/
          Display:  https://nicbenson.com.au/cv/[cv-item-number] 

          OR 

          Home:     https://cv.nicbenson.com.au/
          Display:  https://cv.nicbenson.com.au/[cv-item-number] 
          -->
          <!-- <router-link to="/build"> Builder</router-link> -->
        </li>
        <!-- <li><router-link to="/cv/">CV</router-link></li> -->
        <li>
          <!-- <a href="#" @click="settings.showCreateItemModal = true">Create Item +</a> -->
        </li>
      </ul>
    </nav>
    <hr />
    <!-- <hgroup>
      <h1>{{ route.name }}</h1>
      <h3>
        {{
          route.path == "/build"
            ? "Create a custom resume from your previously saved items"
            : ""
        }}
      </h3>
    </hgroup> -->
  </header>
  <header id="print-header">
    <h2>Nicholas Benson CV</h2>
  </header>
</template>
<style>
@media print {
  #site-header {
    display: none;
  }
  #print-header {
    display: block;
  }
}
@media screen {
  #site-header {
    display: block;
  }
  #print-header {
    display: none;
    display: none;
  }
}
</style>
