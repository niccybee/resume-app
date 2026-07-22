import { defineStore } from "pinia";
import { supabase } from "../supabase";

const initializationByStore = new WeakMap();

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    ready: false,
    loading: false,
    pendingAction: "",
    feedbackAction: "",
    error: "",
    notice: "",
  }),
  actions: {
    startAction(action) {
      this.loading = true;
      this.pendingAction = action;
      this.feedbackAction = "";
      this.error = "";
      this.notice = "";
    },
    finishAction(action, { error = "", notice = "" } = {}) {
      this.loading = false;
      this.pendingAction = "";
      this.feedbackAction = action;
      this.error = error;
      this.notice = notice;
    },
    clearFeedback() {
      if (this.loading) return;
      this.feedbackAction = "";
      this.error = "";
      this.notice = "";
    },
    async initialize() {
      if (this.ready) return;
      if (!initializationByStore.has(this)) {
        const initializePromise = (async () => {
          const { data } = await supabase.auth.getSession();
          this.user = data.session?.user || null;
          supabase.auth.onAuthStateChange((_event, session) => {
            this.user = session?.user || null;
          });
          this.ready = true;
        })().finally(() => {
          initializationByStore.delete(this);
        });
        initializationByStore.set(this, initializePromise);
      }
      await initializationByStore.get(this);
    },
    async requestMagicLink(email, redirectTo = `${window.location.origin}/app/cvs`) {
      this.startAction("magic-link");
      try {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
        });
        if (error) {
          this.finishAction("magic-link", { error: error.message });
          return false;
        }
        this.finishAction("magic-link", {
          notice: "Check your email for the secure sign-in link.",
        });
        return true;
      } catch (cause) {
        this.finishAction("magic-link", {
          error: cause?.message || "The secure sign-in link could not be sent.",
        });
        return false;
      }
    },
    async signInWithPassword(email, password) {
      this.startAction("password");
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          this.finishAction("password", { error: error.message });
          return false;
        }
        this.user = data.user || data.session?.user || null;
        this.finishAction("password");
        return Boolean(this.user);
      } catch (cause) {
        this.finishAction("password", {
          error: cause?.message || "Password sign-in could not be completed.",
        });
        return false;
      }
    },
    async signInWithGoogle(redirectTo = `${window.location.origin}/app/cvs`) {
      this.startAction("google");
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo },
        });
        if (error) {
          this.finishAction("google", { error: error.message });
          return false;
        }
        this.finishAction("google");
        return true;
      } catch (cause) {
        this.finishAction("google", {
          error: cause?.message || "Google sign-in could not be started.",
        });
        return false;
      }
    },
    async signOut() {
      await supabase.auth.signOut();
      this.user = null;
    },
  },
});
