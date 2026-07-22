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
        base: "rounded-none",
      },
    },
    textarea: {
      slots: {
        base: "rounded-none",
      },
    },
    select: {
      slots: {
        base: "rounded-none",
      },
    },
  },
});
