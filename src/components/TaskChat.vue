<script setup>
import { computed, ref } from "vue";
import { parseTaskPrompt } from "../domain/tasks/taskJson";

const props = defineProps({
  createTasksHandler: { type: Function, default: null },
});
const emit = defineEmits(["createTasks"]);
const prompt = ref("");
const errorMessage = ref("");
const output = ref(null);
const creating = ref(false);
const messages = ref([
  {
    role: "assistant",
    text: "Describe one or more employment tasks. I’ll return reviewable JSON before anything is added.",
  },
]);

const formattedOutput = computed(() =>
  output.value ? JSON.stringify(output.value, null, 2) : "",
);

function useExample() {
  prompt.value =
    "E2 as Growth Lead from 2024-02 to present: Built a quarterly acquisition roadmap";
}

function submitPrompt() {
  errorMessage.value = "";
  try {
    const result = parseTaskPrompt(prompt.value);
    messages.value.push({ role: "user", text: prompt.value.trim() });
    messages.value.push({
      role: "assistant",
      text: `Prepared ${result.tasks.length} draft task${result.tasks.length === 1 ? "" : "s"}. Review the JSON before creating them.`,
    });
    output.value = result;
    prompt.value = "";
  } catch (error) {
    errorMessage.value = error.message;
  }
}

async function createTasks() {
  if (!output.value) return;
  errorMessage.value = "";
  creating.value = true;
  try {
    if (props.createTasksHandler) {
      await props.createTasksHandler(output.value.tasks);
    } else {
      emit("createTasks", output.value.tasks);
    }
    messages.value.push({
      role: "assistant",
      text: `${output.value.tasks.length} task${output.value.tasks.length === 1 ? "" : "s"} added to the active draft.`,
    });
    output.value = null;
  } catch (error) {
    errorMessage.value = error.message || "The task blocks could not be saved.";
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <section class="task-chat" aria-labelledby="task-chat-title">
    <header class="task-chat-header">
      <div>
        <p class="task-chat-eyebrow">Structured assistant</p>
        <h2 id="task-chat-title">Turn work notes into tasks</h2>
      </div>
      <button type="button" class="control-compact secondary" @click="useExample">
        Use example
      </button>
    </header>

    <ol class="chat-thread" aria-live="polite">
      <li
        v-for="(message, index) in messages"
        :key="`${message.role}-${index}`"
        :class="['chat-message', `chat-message-${message.role}`]"
      >
        <span>{{ message.role === "assistant" ? "Workshop" : "You" }}</span>
        <p>{{ message.text }}</p>
      </li>
    </ol>

    <div class="chat-input-group">
      <textarea
        v-model="prompt"
        rows="3"
        aria-label="Task instructions"
        placeholder="E2 as Growth Lead from 2024-02 to present: Built…"
        @keydown.meta.enter.prevent="submitPrompt"
        @keydown.ctrl.enter.prevent="submitPrompt"
      ></textarea>
      <div class="chat-input-addon">
        <small>JSON or one occasion per line · ⌘/Ctrl + Enter</small>
        <button
          type="button"
          class="control-compact"
          data-testid="generate-task-json"
          @click="submitPrompt"
        >
          Generate JSON
        </button>
      </div>
    </div>
    <p v-if="errorMessage" class="inline-error" role="alert">
      {{ errorMessage }}
    </p>

    <div v-if="output" class="json-review">
      <div class="json-review-heading">
        <div>
          <p class="task-chat-eyebrow">Proposed mutation</p>
          <h3>JSON output</h3>
        </div>
        <button
          type="button"
          class="control-standard"
          data-testid="create-json-tasks"
          :aria-busy="creating"
          :disabled="creating"
          @click="createTasks"
        >
          Create {{ output.tasks.length }} task{{ output.tasks.length === 1 ? "" : "s" }}
        </button>
      </div>
      <pre data-testid="task-json"><code>{{ formattedOutput }}</code></pre>
    </div>
  </section>
</template>

<style scoped>
.task-chat { margin: 1.5rem 0 2rem; border: 1px solid #cbd7d1; background: #fff; }
.task-chat-header, .json-review-heading, .chat-input-addon { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.task-chat-header { padding: 1.25rem; border-bottom: 1px solid #dce3df; }
.task-chat h2, .task-chat h3, .task-chat p { margin-bottom: 0; }
.task-chat h2 { font-size: clamp(1.35rem, 3vw, 1.8rem); }
.task-chat-eyebrow, .chat-message > span { color: #37624e; font-size: .65rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
.chat-thread { display: grid; gap: .75rem; max-height: 17rem; margin: 0; padding: 1.25rem; overflow-y: auto; list-style: none; }
.chat-message { max-width: 82%; padding: .75rem .9rem; border: 1px solid #cbd7d1; background: #f6f8f6; }
.chat-message-user { justify-self: end; background: #e6f0eb; }
.chat-message p { margin-top: .25rem; font-size: .9rem; }
.chat-input-group { margin: 0 1.25rem 1.25rem; border: 1px solid #8ca398; background: #fff; }
.chat-input-group:focus-within { box-shadow: 0 0 0 .2rem rgba(55, 98, 78, .2); }
.chat-input-group textarea { min-height: 6.25rem; margin: 0; border: 0 !important; border-radius: 0; resize: vertical; box-shadow: none; }
.chat-input-addon { padding: .6rem; border-top: 1px solid #dce3df; }
.chat-input-addon small { color: #52635b; font-size: .72rem; }
.inline-error { margin: -.5rem 1.25rem 1.25rem; color: #a12626; }
.json-review { padding: 1.25rem; border-top: 1px solid #dce3df; background: #19221f; }
.json-review h3, .json-review .task-chat-eyebrow { color: #fff; }
.json-review pre { max-height: 20rem; margin: 1rem 0 0; padding: 1rem; overflow: auto; border: 1px solid #52635b; border-radius: 0; background: #0f1513; color: #fff; font-size: .72rem; }
@media (max-width: 640px) { .task-chat-header, .json-review-heading, .chat-input-addon { align-items: stretch; flex-direction: column; } .chat-message { max-width: 95%; } }
</style>
