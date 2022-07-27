<script setup>
import { useCvStore } from "../stores/cvStore";
import Profile from "../components/CV/Profile.vue";
import Work from "../components/CV/Work.vue";
import Certifications from "../components/CV/Certifications.vue";
import Languages from "../components/CV/Languages.vue";
import Interests from "../components/CV/Interests.vue";
import Skills from "../components/CV/Skills.vue";

// TODO: fix this naming scheme wtf
const resume = useCvStore();
const cv = resume.blankSlate;
</script>
<template>
  <div id="cv" class="container">
    <Profile :profileInfo="[cv.basics, cv.skills]" />
    <div id="body" class="grid">
      <div id="main"><Work :workInfo="cv.work" /></div>
      <div id="sidebar">
        <Skills :skills="cv.skills" />
        <Certifications :certificates="cv.certificates" />
        <Languages :languages="cv.languages" />
        <Interests :interests="cv.interests" />
      </div>
    </div>
  </div>

  <!-- <div>
    <p v-for="(c, i) in cv">{{ i }}{{ c }}</p>
  </div> -->
</template>
<style scoped>
@media print {
  .grid {
    grid-template-columns: 1fr 1fr 1fr;
  }
  article {
    page-break-inside: avoid;
  }
  article > p,
  span,
  ul,
  li {
    font-size: 0.7rem;
  }
}
#body {
  grid-template-columns: 1fr 1fr 1fr;
}
#main {
  grid-column-start: span 2;
}
#sidebar {
}
</style>
