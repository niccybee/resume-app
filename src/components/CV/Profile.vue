<script setup>
import { defineProps } from "vue";

const props = defineProps(["profileInfo"]);
const profile = props.profileInfo;
const relevantExp = props.profileInfo[2];
const showImage = props.profileInfo[3];

// TODO: proper destructure here to clean up code
</script>
<template>
  <!-- <sub>{{ profile }}</sub> -->
  <div id="profile" class="grid">
    <div id="basics">
      <div class="flex">
        <div>
          <h3 style="margin-bottom: 1rem">Summary</h3>
          <p>{{ profile[0].summary }}</p>
        </div>
      </div>
      <div></div>
      <div class="flex">
        <div>
          <h3 style="margin-bottom: 1rem">Relevant Experience</h3>
          <ul>
            <!-- TODO: Fix this inline style -->
            <li style="font-size: 1rem" v-for="r in relevantExp">{{ r }}</li>
          </ul>
        </div>
      </div>
    </div>

    <article class="cv-sidebar-article" style="padding-bottom:1rem;">
      <div>
        <hgroup>
          <img
            v-if="showImage"
            style="max-width: 100px; border-radius: 0.2rem"
            src="https://media-exp2.licdn.com/dms/image/C4D03AQGYansPbCidug/profile-displayphoto-shrink_400_400/0/1530152793273?e=1662595200&v=beta&t=f0eFX2t8gi6QGS2EtJejvAh80bTgBdhS1y2zOnB-rc0"
            alt=""
          />
          <h4 class="cv-sidebar-header">Personal Details</h4>
          <p >
            <span>{{ profile[0].name }},</span> <br />
            <span>{{ profile[0].label }}</span> <br />
            <hr>
            📍
            <span class="cv-sidebar-content" v-for="(l, i) in profile[0].location"> {{ l + " " }} </span> <br />
            <a class="cv-sidebar-content" :href="'mailto:' + profile[0].email">📧</a>
            |
            <a class="cv-sidebar-content" :href="profile[0].url"> <span>🌐 | </span></a>
            <a class="cv-sidebar-content" href="p.url" v-for="p in profile[0].profiles"
              ><span class="cv-sidebar-content">{{ p.network }} </span></a
            >
            | <br>
            <span class="cv-sidebar-content"
              ><a :href="'tel:' + profile[0].phone">{{ profile[0].phone }}</a></span
            >
   
          </p>
        </hgroup>
        <div></div>
      </div>
    </article>
  </div>
</template>
<style>
.flex {
  display: flex;
  /* flex-wrap: wrap; */
  gap: 0.4rem;
}

#profile {
  grid-template-columns: 1fr 1fr 1fr;
}
#basics {
  grid-column-start: span 2;
}
</style>
