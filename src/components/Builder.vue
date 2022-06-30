<script setup>
import { ref, onMounted } from "vue";

const props = defineProps({
  selectedItems: Array,
});

const showBuilder = ref(true);
</script>
<template>
  <article class="card builder" @addToResume="addItem(item)">
    <div class="grid">
      <div>
        <a href="#" role="button" class="secondary" @click="showBuilder = !showBuilder">
          {{ showBuilder ? "-" : "+" }}
        </a>
      </div>
      <div>
        <p>{{ selectedItems.length }}{{ showBuilder ? " items" : "" }}</p>
      </div>
    </div>
    <div>
      <div v-if="showBuilder">
        <header>
          <hgroup>
            <h2>Active List</h2>
            <h4>Included:</h4>
            <p>{{ collectedItems }}</p>
          </hgroup>
        </header>
        <figure>
          <table>
            <tr v-for="item in selectedItems">
              <!-- <hgroup> -->
              <td>
                <b>{{ item.employer }}</b>
              </td>
              <!-- </hgroup> -->
              <td>{{ item.item }}</td>
            </tr>
          </table>
        </figure>
        <footer>
          <div class="grid">
            <button>Edit Resume</button>
          </div>
          <div>
            <button class="contrast">Clear Resume</button>
          </div>
        </footer>
      </div>
    </div>
  </article>
</template>
<style>
.builder {
  position: fixed;
  right: 0;
  bottom: 0;
  max-width: 90%;
}
@media only screen and (max-width: 600px) {
  .builder {
    max-width: 100%;
  }
}
</style>
