<script setup>
import { useCvStore } from "../stores/cvStore";
import { storeToRefs } from "pinia";

const { cvs, CVsLoading, CVsError } = storeToRefs(useCvStore());
const { getCVs } = useCvStore();

getCVs();
</script>

<template>
  <p v-if="CVsError" role="alert">
    Saved CVs are unavailable: {{ CVsError }}
  </p>
  <p v-else-if="CVsLoading" aria-busy="true">Loading saved CVs…</p>
  <div v-else>
    <!-- <p>ites: {{ cvs }}</p>
    <p>ites: {{ items }}</p> -->
    <router-link :to="`/cv/${cv.resume_name}`" v-for="cv in cvs">
      <article>
        {{ cv.resume_name }}
      </article>
    </router-link>
  </div>
</template>
