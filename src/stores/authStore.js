import { defineStore } from "pinia";
import { supabase } from "../supabase";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    ready: false,
    loading: false,
    error: "",
    notice: "",
  }),
  actions: {
    async initialize() {
      if (this.ready) return;
      const { data } = await supabase.auth.getSession();
      this.user = data.session?.user || null;
      supabase.auth.onAuthStateChange((_event, session) => {
        this.user = session?.user || null;
      });
      this.ready = true;
    },
    async requestMagicLink(email, redirectTo = `${window.location.origin}/app/cvs`) {
      this.loading = true;
      this.error = "";
      this.notice = "";
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      });
      this.loading = false;
      if (error) {
        this.error = error.message;
        return false;
      }
      this.notice = "Check your email for the secure sign-in link.";
      return true;
    },
    async signOut() {
      await supabase.auth.signOut();
      this.user = null;
    },
  },
});
