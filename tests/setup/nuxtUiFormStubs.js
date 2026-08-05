import { config } from "@vue/test-utils";
import { defineComponent, h } from "vue";

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function formControlStub(tag) {
  return defineComponent({
    name: `Test${tag}`,
    inheritAttrs: false,
    props: {
      modelValue: { type: [String, Number], default: "" },
      type: { type: String, default: undefined },
    },
    emits: ["update:modelValue"],
    setup(props, { attrs, emit }) {
      return () => h(tag, {
        ...attrs,
        ...(props.type ? { type: props.type } : {}),
        value: props.modelValue ?? "",
        onInput: (event) => emit("update:modelValue", event.target.value),
      });
    },
  });
}

const USelect = defineComponent({
  name: "TestUSelect",
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number], default: "" },
    items: { type: Array, default: () => [] },
  },
  emits: ["update:modelValue"],
  setup(props, { attrs, emit }) {
    const normalizedItems = () => props.items.flat().map((item) => (
      typeof item === "object"
        ? item
        : { label: String(item), value: item }
    ));

    return () => h("select", {
      ...attrs,
      value: props.modelValue ?? "",
      onChange: (event) => {
        const selected = normalizedItems().find((item) => String(item.value ?? "") === event.target.value);
        emit("update:modelValue", selected?.value ?? event.target.value);
      },
    }, normalizedItems().map((item) => h("option", {
      key: String(item.value ?? ""),
      value: item.value ?? "",
    }, item.label)));
  },
});

config.global.components = {
  ...config.global.components,
  UInput: formControlStub("input"),
  UTextarea: formControlStub("textarea"),
  USelect,
};
