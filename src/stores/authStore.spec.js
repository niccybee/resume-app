import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authClient = {
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithOtp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
};

vi.mock("../supabase", () => ({
  supabase: { auth: authClient },
}));

const { useAuthStore } = await import("./authStore");

describe("auth store sign-in methods", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("starts Google OAuth with the preserved login redirect", async () => {
    authClient.signInWithOAuth.mockResolvedValue({ data: { url: "https://google.test" }, error: null });
    const store = useAuthStore();

    await expect(store.signInWithGoogle("https://cv.example/login?redirect=%2Fapp%2Fcvs"))
      .resolves.toBe(true);

    expect(authClient.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://cv.example/login?redirect=%2Fapp%2Fcvs" },
    });
    expect(store).toMatchObject({
      loading: false,
      pendingAction: "",
      feedbackAction: "google",
      error: "",
    });
  });

  it("signs in with email and password and stores the authenticated user", async () => {
    const user = { id: "owner-1", email: "owner@example.test" };
    authClient.signInWithPassword.mockResolvedValue({ data: { user, session: { user } }, error: null });
    const store = useAuthStore();

    await expect(store.signInWithPassword("owner@example.test", "correct horse battery staple"))
      .resolves.toBe(true);

    expect(authClient.signInWithPassword).toHaveBeenCalledWith({
      email: "owner@example.test",
      password: "correct horse battery staple",
    });
    expect(store.user).toEqual(user);
    expect(store.feedbackAction).toBe("password");
  });

  it("retains the failed action so the UI can offer an accurate retry", async () => {
    authClient.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });
    const store = useAuthStore();

    await expect(store.signInWithPassword("owner@example.test", "incorrect"))
      .resolves.toBe(false);

    expect(store).toMatchObject({
      loading: false,
      pendingAction: "",
      feedbackAction: "password",
      error: "Invalid login credentials",
    });
  });

  it("names the completed magic-link action for its confirmation state", async () => {
    authClient.signInWithOtp.mockResolvedValue({ error: null });
    const store = useAuthStore();

    await expect(store.requestMagicLink(
      "owner@example.test",
      "https://cv.example/login?redirect=%2Fapp%2Fcvs",
    )).resolves.toBe(true);

    expect(store).toMatchObject({
      pendingAction: "",
      feedbackAction: "magic-link",
      notice: "Check your email for the secure sign-in link.",
    });
  });
});
