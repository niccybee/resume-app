<script setup>
import { computed, ref } from "vue";
import { parseTaskPrompt } from "../domain/tasks/taskJson";

const props = defineProps({
  createTasksHandler: { type: Function, default: null },
  generateTasksHandler: { type: Function, default: null },
});
const emit = defineEmits(["createTasks"]);
const prompt = ref("");
const errorMessage = ref("");
const output = ref(null);
const reviewJson = ref("");
const creating = ref(false);
const generating = ref(false);
const messages = ref([
  {
    role: "assistant",
    text: "Describe one or more employment achievements. I’ll return a reviewable Change Proposal before anything is applied.",
  },
]);

const formattedOutput = computed(() => reviewJson.value);

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
      text: `Prepared ${result.tasks.length} proposed CV Block${result.tasks.length === 1 ? "" : "s"}. Review the JSON before applying the Change Proposal.`,
    });
    output.value = result;
    reviewJson.value = JSON.stringify(result, null, 2);
    prompt.value = "";
  } catch (error) {
    errorMessage.value = error.message;
  }
}

async function generateWithAi() {
  if (!props.generateTasksHandler) return;
  errorMessage.value = "";
  generating.value = true;
  try {
    const instruction = prompt.value.trim();
    if (!instruction) throw new Error("Describe at least one task.");
    const result = parseTaskPrompt(JSON.stringify(
      await props.generateTasksHandler(instruction),
    ));
    result.tasks = result.tasks.map((task) => ({
      ...task,
      source: { type: "ai", provider: "openrouter" },
    }));
    messages.value.push({ role: "user", text: instruction });
    messages.value.push({
      role: "assistant",
      text: `Prepared ${result.tasks.length} AI-proposed CV Block${result.tasks.length === 1 ? "" : "s"}. Review and edit the Change Proposal before applying it.`,
    });
    output.value = result;
    reviewJson.value = JSON.stringify(result, null, 2);
    prompt.value = "";
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    generating.value = false;
  }
}

function discardProposal() {
  output.value = null;
  reviewJson.value = "";
  errorMessage.value = "";
}

async function createTasks() {
  if (!output.value) return;
  errorMessage.value = "";
  creating.value = true;
  try {
    const reviewed = parseTaskPrompt(reviewJson.value);
    output.value = reviewed;
    if (props.createTasksHandler) {
      await props.createTasksHandler(reviewed.tasks);
    } else {
      emit("createTasks", reviewed.tasks);
    }
    messages.value.push({
      role: "assistant",
      text: `${output.value.tasks.length} CV Block${output.value.tasks.length === 1 ? "" : "s"} added to the current CV.`,
    });
    output.value = null;
    reviewJson.value = "";
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
        <h2 id="task-chat-title">Turn work notes into CV Blocks</h2>
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
      <UTextarea
        v-model="prompt"
        rows="3"
        aria-label="Task instructions"
        placeholder="E2 as Growth Lead from 2024-02 to present: Built…"
        @keydown.meta.enter.prevent="submitPrompt"
        @keydown.ctrl.enter.prevent="submitPrompt"
      />
      <div class="chat-input-addon">
        <small>JSON or one occasion per line · ⌘/Ctrl + Enter</small>
        <div class="chat-input-actions">
          <button
            type="button"
            class="control-compact secondary"
            data-testid="generate-task-json"
            @click="submitPrompt"
          >
            Review manual input
          </button>
          <button
            v-if="generateTasksHandler"
            type="button"
            class="control-compact"
            data-testid="generate-ai-task-json"
            :aria-busy="generating"
            :disabled="generating"
            @click="generateWithAi"
          >
            Ask OpenRouter
          </button>
        </div>
      </div>
    </div>
    <p v-if="errorMessage" class="inline-error" role="alert">
      {{ errorMessage }}
    </p>

    <div v-if="output" class="json-review">
      <div class="json-review-heading">
        <div>
          <p class="task-chat-eyebrow">Change Proposal</p>
          <h3>Proposed CV Blocks</h3>
        </div>
        <button
          type="button"
          class="control-standard"
          data-testid="create-json-tasks"
          :aria-busy="creating"
          :disabled="creating"
          @click="createTasks"
        >
          Apply Change Proposal
        </button>
        <button
          type="button"
          class="secondary control-standard"
          data-testid="discard-task-json"
          :disabled="creating"
          @click="discardProposal"
        >
          Discard
        </button>
      </div>
      <label class="review-editor-label">
        Edit Change Proposal JSON
        <UTextarea
          v-model="reviewJson"
          data-testid="edit-task-json"
          aria-label="Edit Change Proposal JSON"
          rows="12"
          spellcheck="false"
        />
      </label>
      <pre data-testid="task-json"><code>{{ formattedOutput }}</code></pre>
    </div>
  </section>
</template>

<style scoped>
.task-chat { margin: 1.5rem 0 2rem; border: 2px solid var(--ink); background: var(--paper-light); box-shadow: 6px 6px 0 var(--paper-deep); }
.task-chat-header, .json-review-heading, .chat-input-addon { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.task-chat-header { padding: 1.25rem; border-bottom: 1px solid var(--ink); }
.task-chat h2, .task-chat h3, .task-chat p { margin-bottom: 0; }
.task-chat h2 { font-size: clamp(1.5rem, 3vw, 2.1rem); font-weight: 400; }
.task-chat-eyebrow, .chat-message > span { color: var(--marker-dark); font-family: var(--font-label); font-size: .65rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
.chat-thread { display: grid; gap: .75rem; max-height: 17rem; margin: 0; padding: 1.25rem; overflow-y: auto; list-style: none; }
.chat-message { max-width: 82%; padding: .75rem .9rem; border: 1px solid var(--ink); background: var(--paper); }
.chat-message-user { justify-self: end; background: var(--marker-soft); }
.chat-message p { margin-top: .25rem; font-size: .9rem; }
.chat-input-group { margin: 0 1.25rem 1.25rem; border: 1px solid var(--ink); background: var(--paper-light); }
.chat-input-group:focus-within { box-shadow: 0 0 0 .2rem rgb(240 90 61 / 20%); }
.chat-input-group textarea { min-height: 6.25rem; margin: 0; border: 0 !important; border-radius: 0; resize: vertical; box-shadow: none; }
.chat-input-addon { padding: .6rem; border-top: 1px solid var(--paper-deep); }
.chat-input-addon small { color: var(--muted); font-size: .72rem; }
.chat-input-actions { display: flex; flex-wrap: wrap; gap: .5rem; }
.inline-error { margin: -.5rem 1.25rem 1.25rem; color: var(--danger); }
.json-review { padding: 1.25rem; border-top: 1px solid var(--ink); background: var(--ink); }
.json-review h3, .json-review .task-chat-eyebrow { color: var(--paper-light); }
.json-review pre { max-height: 20rem; margin: 1rem 0 0; padding: 1rem; overflow: auto; border: 1px solid var(--paper-deep); border-radius: 0; background: #0e0d0b; color: var(--paper-light); font-size: .72rem; }
.review-editor-label { display: block; margin-top: 1rem; color: var(--paper-light); }
.review-editor-label textarea { margin-top: .4rem; border-color: var(--paper-deep); background: #0e0d0b; color: var(--paper-light); font-family: var(--font-label); font-size: .75rem; }
@media (max-width: 640px) { .task-chat-header, .json-review-heading, .chat-input-addon { align-items: stretch; flex-direction: column; } .chat-message { max-width: 95%; } }
</style>
