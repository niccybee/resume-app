<script setup>
import { ref, onMounted } from "vue";
import { useItemsStore } from "../stores/itemStore";

const items = useItemsStore();

const props = defineProps({
  selectedItems: Array,
});

const showBuilder = ref(true);

//
let showConfirmClear = ref(false);

function clearResume() {
  showConfirmClear = true;
}
</script>
<template>
  <article v-if="showConfirmClear">
    <header>
      <a
        href="#close"
        aria-label="Close"
        class="close"
        @click="settings.showCreateItemModal = false"
      ></a>
      <hgroup>
        <h2>Are you sure you want to clear the item?</h2>
        <p>Confirm clearing.</p>
      </hgroup>
      <div class="">
        <a role="button" class="secondary" href=""></a>
        <a role="button" class="destructive" href=""></a>
      </div>
    </header>
  </article>
  <article v-else class="card builder" @addToResume="addItem(item)">
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
            <button class="contrast" @click="clearResume">Clear Resume</button>
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
