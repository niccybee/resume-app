export default defineAppConfig({
  ui: {
    colors: {
      primary: "marker",
      secondary: "stone",
      success: "emerald",
      warning: "amber",
      error: "red",
      neutral: "stone",
    },
    button: {
      slots: {
        base: "rounded-none font-mono font-bold uppercase tracking-[0.06em] transition-[transform,box-shadow] duration-150",
      },
    },
    card: {
      slots: {
        root: "rounded-none shadow-none",
      },
    },
    input: {
      slots: {
        root: "w-full",
        base: "min-h-[var(--control-standard-height)] rounded-none bg-default",
      },
    },
    textarea: {
      slots: {
        root: "w-full",
        base: "rounded-none bg-default",
      },
    },
    select: {
      slots: {
        base: "min-h-[var(--control-standard-height)] w-full rounded-none bg-default",
        content: "rounded-none",
        item: "rounded-none",
      },
    },
  },
});
