<script setup>
import { ref, reactive } from "vue";
import { useItemsStore } from "../stores/itemStore";
import { useSettingStore } from "../stores/appSettingsStore";
// stores
const settings = useSettingStore();
const items = useItemsStore();

// Vars
let loading = ref(false);
let submitted = ref(false);
let errorMessage = ref("");

const newItem = reactive({
  employer: "",
  role: "",
  item: "",
});

function displayModal() {
  settings.showCreateItemModal = true;
}
//  create item function
const createNewResumeItem = async () => {
  loading.value = true;
  errorMessage.value = "";
  try {
    await items.createExperienceBlock({
      employer: newItem.employer,
      role: newItem.role,
      text: newItem.item,
    });
    submitted.value = true;
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
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
        <input
          type="text"
          name="employer"
          id="employers"
          list="employer-list"
          placeholder="Enter your employer"
          v-model="newItem.employer"
          required
        />
        <datalist id="employer-list">
          <option :value="e" v-for="e in items.employers">{{ e }}</option>
        </datalist>
        <input
          type="text"
          name="role"
          id="roles"
          list="role-list"
          placeholder="Enter your role"
          v-model="newItem.role"
          required
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
          required
        />
        <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
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
