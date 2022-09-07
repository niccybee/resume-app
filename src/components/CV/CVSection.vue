<script setup>
const props = useProps({
  title: String,
  subtitle: String,
  data: Array,
  image: Boolean,
  dates: Boolean,
  list: Boolean,
  sideContent: Boolean,
});
</script>
<template>
  <div>
    <article v-if="sideContent">
      {{ data }}
      <hrgroup>
        <h6>{{ title }}</h6>
        <p>
          <sub>{{ data[1] }}</sub>
          <br />
          {{ data[0] }}
        </p>
      </hrgroup>
    </article>
  </div>
</template>
