import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const loginPage = await readFile(new URL("../app/pages/login.vue", import.meta.url), "utf8");

describe("Nuxt login choices", () => {
  it("places Google above tabbed email-link and password methods", () => {
    const googlePosition = loginPage.indexOf("google-action");
    const tabsPosition = loginPage.indexOf("<UTabs");

    expect(googlePosition).toBeGreaterThan(-1);
    expect(tabsPosition).toBeGreaterThan(googlePosition);
    expect(loginPage).toContain('{ label: "Magic link", value: "magic-link"');
    expect(loginPage).toContain('{ label: "Password", value: "password"');
    expect(loginPage).toContain('autocomplete="current-password"');
  });

  it("uses action-specific loading, success, and retry labels", () => {
    expect(loginPage).toContain("Connecting to Google…");
    expect(loginPage).toContain("Try Google sign-in again");
    expect(loginPage).toContain("Sending secure link…");
    expect(loginPage).toContain("Sign-in link sent");
    expect(loginPage).toContain("Try sending the link again");
    expect(loginPage).toContain("Signing in…");
    expect(loginPage).toContain("Try password sign-in again");
  });

  it("retains the destination while using a stable external-auth callback", () => {
    expect(loginPage).toContain(
      "rememberExternalAuthDestination(window.localStorage, destination.value)",
    );
    expect(loginPage).toContain("externalAuthCallbackUrl(window.location.origin)");
    expect(loginPage).toContain("const oauthUrl = await auth.signInWithGoogle(");
    expect(loginPage).toContain("if (oauthUrl) window.location.assign(oauthUrl)");
  });
});
