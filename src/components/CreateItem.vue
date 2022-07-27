<script setup>
import { ref, reactive, defineProps, watch, onMounted } from "vue";
import dayjs from "dayjs";
import { supabase } from "../supabase";
import { useItemsStore } from "../stores/itemStore";
import { useSettingStore } from "../stores/appSettingsStore";
// stores
const settings = useSettingStore();
const items = useItemsStore();

const itemsList = ref(items.items);

// Vars
let listLength = items.itemListLength;
let loading = ref(false);
let submitted = ref(false);

const displayedDate = ref("");

const newItem = reactive({
  id: items.itemListLength + 1,
  employer: "",
  role: "",
  item: "",
  created: displayedDate.value,
});

function displayModal() {
  settings.showCreateItemModal = true;
}
function closeModal() {
  settings.showCreateItemModal = true;
}
// helper functions
function createDate() {
  let today = dayjs().format();
  let createTodaysDisplayedDate = dayjs(today).format("YYYY-MM-DD");
  let createItemDate = dayjs(today).format("DD-MM-YYYY");
  displayedDate.value = createTodaysDisplayedDate;
  newItem.created = createItemDate;
}
function createID() {
  return listLength + 1;
}
// lifecycle hooks
onMounted(() => {
  createDate();
});

//  create item function
const createNewResumeItem = async () => {
  loading.value = true;
  const { data, error } = await supabase.from("CV_Items").insert([newItem]);

  if (error) {
    console.error(error);
  } else {
    console.log(data);
    loading.value = false;
    submitted.value = true;
  }
};
</script>
<template>
  <dialog :open="settings.showCreateItemModal">
    <article>
      <header>
        <a
          href="#close"
          aria-label="Close"
          class="close"
          @click="settings.showCreateItemModal = false"
        ></a>
        <hgroup>
          <h2>Create Item</h2>
          <p>Create a new item to add to CV <br /></p>
        </hgroup>
      </header>

      <div class="card">
        <!-- <p>{{ newItem }}</p> -->
        <summary>
          <h6>id:</h6>
          <input type="number" name="" id="" :value="createID()" disabled />
        </summary>
        <!-- <h6>employer:</h6> -->
        <input
          type="text"
          name="employer"
          id="employers"
          list="employer-list"
          placeholder="Enter your employer"
          v-model="newItem.employer"
        />
        <datalist id="employer-list">
          <option :value="e" v-for="e in items.employers">{{ e }}</option>
        </datalist>
        <!-- <h6>roles:</h6> -->
        <input
          type="text"
          name="role"
          id="roles"
          list="role-list"
          placeholder="Enter your role"
          v-model="newItem.role"
        />
        <datalist id="role-list">
          <option :value="r" v-for="r in items.roles">{{ r }}</option>
        </datalist>
        <input
          type="text"
          name="item"
          id="item"
          placeholder="Enter your resume item"
          v-model="newItem.item"
        />
        hello: {{ newItem.createdDate }}
        <input
          type="date"
          name="create-date"
          id="createDate"
          v-model="displayedDate"
          disabled
        />
      </div>
      <footer>
        <div>
          <a
            href="#"
            role="button"
            :class="!submitted ? 'secondary' : 'contrast'"
            data-target="modal-example"
            @click="settings.showCreateItemModal = false"
          >
            {{ !submitted ? "Cancel" : "Close" }}
          </a>

          <a
            v-if="!submitted"
            href="#confirm"
            role="button"
            data-target="modal-example"
            :aria-busy="loading ? 'true' : 'false'"
            @click="createNewResumeItem"
          >
            Confirm
          </a>
          <a v-else href="#" class="secondary" role="button">✔</a>
        </div>
      </footer>
    </article>
  </dialog>
</template>
