<script setup>
import { useCvStore } from "../stores/cvStore";
import Profile from "../components/CV/Profile.vue";
import Work from "../components/CV/Work.vue";
import Certifications from "../components/CV/Certifications.vue";
import Languages from "../components/CV/Languages.vue";
import Interests from "../components/CV/Interests.vue";
import Skills from "../components/CV/Skills.vue";
import Education from "../components/CV/Education.vue";

// TODO: fix this naming scheme wtf
const resume = useCvStore();
const cv = resume.blankSlate;
const relevantExp = resume.relevantExp;
const showImage = resume.showImage;
</script>
<template>
  <div id="cv" class="container">
    <Profile
      class="side-content"
      :profileInfo="[cv.basics, cv.skills, relevantExp, showImage]"
    />
    <div id="body" class="grid">
      <div id="main">
        <Work class="side-content" :workInfo="cv.work" />
      </div>
      <div id="sidebar">
        <Education class="side-content" :education="cv.education" />
        <Skills class="side-content" :skills="cv.skills" />
        <Certifications class="side-content" :certificates="cv.certificates" />
        <Languages class="side-content" :languages="cv.languages" />
        <Interests class="side-content" :interests="cv.interests" />
      </div>
    </div>
  </div>

  <!-- <div>
    <p v-for="(c, i) in cv">{{ i }}{{ c }}</p>
  </div> -->
</template>
<style scoped>
hgroup > h1,
h2,
h3,
h4,
h5,
h6 {
  --sidebarhead: 1.1rem;
}
article {
  box-shadow: 0 0 0;
  border: lightgray solid 1px;
}
@media print {
  .grid {
    grid-template-columns: 1fr 1fr 1fr;
  }
  hgroup {
    page-break-inside: avoid;
  }
  p,
  span,
  ul,
  li {
    font-size: 0.7rem;
  }
}

.side-content {
  font-size: 0.8rem !important;
}
.side-content hgroup:last-child {
  font-size: 0.8rem !important;
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
