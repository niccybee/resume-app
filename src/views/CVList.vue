<script setup>
import { useCvStore } from "../stores/cvStore";
import { storeToRefs } from "pinia";

const { cvs, CVsLoading } = storeToRefs(useCvStore());
console.log("xvs? ", cvs);
const { getCVs } = useCvStore();

getCVs();
</script>

<template>
  <div>
    <!-- <p>ites: {{ cvs }}</p>
    <p>ites: {{ items }}</p> -->
    <router-link :to="`/cv/${cv.resume_name}`" v-for="cv in cvs">
      <article :aria-busy="CVsLoading">
        {{ cv.resume_name }}
      </article>
    </router-link>
  </div>
</template>
