<script setup>
import { ref, reactive, defineProps, watch, onMounted } from "vue";
import dayjs from "dayjs";
import { supabase } from "../supabase";
// props
const props = defineProps({
  itemsList: Array,
  showModalProp: Boolean,
  // closeModalProp: Boolean,
});
// Vars
let listLength = props.itemsList.length;
let loading = ref(false);
let submitted = ref(false);
let showModal = ref(false);
const displayedDate = ref("");
const newItem = reactive({
  id: listLength + 1,
  employer: "",
  role: "",
  item: "",
  created: displayedDate.value,
});
// watch(( props.showModalProp), (thisOne, previousOne) {
//   if (props.showModalProp) {
//     console.log(thisOne, previousOne);
//     displayModal();
//   } else {
//     closeModal();
//   }
// });
// show / close modal
function displayModal() {
  showModal.value = true;
}
function closeModal() {
  showModal.value = false;
  console.log(showModal);
}
// filters
function employers() {
  let employerList = props.itemsList.map((a) => a.employer);
  return [...new Set(employerList)];
}
function roles() {
  let employerList = props.itemsList.map((a) => a.role);
  return [...new Set(employerList)];
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
  <dialog :open="showModal" v-if="showModal">
    <article>
      <a href="#close" aria-label="close" @click="showModal()"></a>

      <hgroup>
        <h2>Create Item</h2>
        <p>
          {{ newItem }}
        </p>
      </hgroup>

      <div class="card">
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
          <option :value="e" v-for="e in employers()">{{ e }}</option>
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
          <option :value="r" v-for="r in roles()">{{ r }}</option>
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
            @click="closeModal()"
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
