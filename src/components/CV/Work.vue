<script setup>
import { defineProps } from "vue";
import dayjs from "dayjs";

const props = defineProps(["workInfo"]);
const work = props.workInfo;
</script>
<template>
  <div id="work">
    <h3 style="margin-bottom: 1rem">Past Experience</h3>
    <div id="work-item" class="container" v-for="w in work">
      <hgroup>
        <h5>
          {{ w.name }} <span><a v-if="w.url" target="_blank" :href="w.url"></a></span>
        </h5>
        <p>
          {{ w.position }} <br /><sub>{{ w.startDate }} - {{ w.endDate }}</sub>
        </p>
      </hgroup>
      <div>
        <ul>
          <li v-for="h in w.highlights">{{ h }}</li>
        </ul>
      </div>
      <hr />
    </div>
  </div>
</template>
<style>
a[target="_blank"]::after {
  content: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAQElEQVR42qXKwQkAIAxDUUdxtO6/RBQkQZvSi8I/pL4BoGw/XPkh4XigPmsUgh0626AjRsgxHTkUThsG2T/sIlzdTsp52kSS1wAAAABJRU5ErkJggg==);
  margin: 0 3px 0 5px;
}
li {
  font-size: 0.8rem;
}
@media print {
  .work-item {
    page-break-inside: avoid;
  }
}
</style>
