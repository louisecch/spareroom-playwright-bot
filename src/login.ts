import { CONFIG } from "./config";
import { launchPersistentContext, saveDebugArtifacts } from "./browser";
import { absoluteUrl } from "./spareRoom/urls";
import { assertLoggedIn } from "./auth";
import { SELECTORS } from "./spareRoom/selectors";

// Load `.env` if present (FB_EMAIL / FB_PASSWORD).
import "dotenv/config";

let reportedMissingLoginControl = false;

/**
 * One-time manual login.
 *
 * This uses a persistent context at `user_data/` so the session is reused across runs.
 * You log in in the visible browser window; then we verify the session by checking
 * for a "Log out" control.
 */
async function acceptCookiesIfPresent(page: import("playwright").Page): Promise<void> {
  // Cookie banners often block clicks on the header "Log in" link.
  // We keep this best-effort and non-fatal.
  const acceptButtons = [
    // Common Facebook consent button label.
    page.getByRole("button", { name: /allow\s+all\s+cookies/i }).first(),
    page.getByRole("button", { name: /accept\s+all/i }).first(),
    page.getByRole("button", { name: /accept/i }).first(),
    page.getByRole("button", { name: /agree/i }).first()
  ];

  for (const btn of acceptButtons) {
    const visible = await btn.isVisible().catch(() => false);
    if (!visible) continue;
    console.log('Cookie banner detected — accepting cookies...');
    await btn.click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(500).catch(() => {});
    return;
  }
}

async function tryFacebookPopupCredentialLogin(
  fbPage: import("playwright").Page
): Promise<boolean> {
  const email = process.env.FB_EMAIL?.trim();
  const password = process.env.FB_PASSWORD?.trim();

  if (!email || !password) {
    console.log("FB_EMAIL/FB_PASSWORD not set; skipping automatic Facebook credential entry.");
    return false;
  }

  await fbPage.waitForLoadState("domcontentloaded").catch(() => {});
  await acceptCookiesIfPresent(fbPage).catch(() => {});

  // Only attempt on Facebook domains to avoid typing credentials into the wrong page.
  const currentUrl = fbPage.url();
  if (!/facebook\.com/i.test(currentUrl)) return false;

  const emailInput = fbPage.locator('input#email, input[name="email"]').first();
  const passInput = fbPage.locator('input#pass, input[name="pass"]').first();

  const emailVisible = await emailInput.isVisible().catch(() => false);
  const passVisible = await passInput.isVisible().catch(() => false);
  if (!emailVisible || !passVisible) {
    // Could be a "continue as" screen, already logged-in, or a checkpoint/2FA flow.
    return false;
  }

  console.log("Entering Facebook credentials from .env...");
  await emailInput.fill(email).catch(() => {});
  await passInput.fill(password).catch(() => {});

  const loginBtn = fbPage.locator('button[name="login"], button[type="submit"], input[type="submit"]').first();
  if (await loginBtn.isVisible().catch(() => false)) {
    await loginBtn.click({ timeout: 10_000 }).catch(() => {});
  } else {
    // Fallback: press Enter in password field.
    await passInput.press("Enter").catch(() => {});
  }

  // If Facebook succeeds, the popup often closes or redirects back.
  await Promise.race([
    fbPage.waitForEvent("close").catch(() => {}),
    fbPage.waitForLoadState("networkidle").catch(() => {}),
    fbPage.waitForTimeout(10_000)
  ]);

  return true;
}

async function clickFacebookContinueAsIfPresent(
  fbPage: import("playwright").Page
): Promise<boolean> {
  // Common intermediate step: "Continue as Louise" (or any name).
  // We keep this flexible to avoid hardcoding the name.
  const continueAsButton = fbPage.getByRole("button", { name: /continue\s+as/i }).first();
  const continueAsLink = fbPage.getByRole("link", { name: /continue\s+as/i }).first();

  if (await continueAsButton.isVisible().catch(() => false)) {
    console.log('Clicking "Continue as ..."');
    await continueAsButton.click({ timeout: 10_000 }).catch(() => {});
    return true;
  }
  if (await continueAsLink.isVisible().catch(() => false)) {
    console.log('Clicking "Continue as ..."');
    await continueAsLink.click({ timeout: 10_000 }).catch(() => {});
    return true;
  }
  return false;
}

async function forceFacebookAuthToSameTab(page: import("playwright").Page): Promise<void> {
  // Best-effort: prevent OAuth links from spawning new tabs/popups.
  // Some sites do this via `target="_blank"` or `window.open(...)`.
  await page
    .evaluate((facebookSelector) => {
      const el = document.querySelector(facebookSelector);
      if (el && el instanceof HTMLAnchorElement) {
        el.removeAttribute("target");
        el.target = "_self";
        el.rel = "noopener"; // harmless even in same-tab; avoids opener leakage.
      }

      // Override window.open to redirect in-tab.
      // We only do this on SpareRoom’s page right before clicking the Facebook auth entry.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__sr_originalWindowOpen = window.open;
      } catch {
        // ignore
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).open = (url: any) => {
        try {
          window.location.href = String(url);
        } catch {
          // ignore
        }
        return null;
      };
    }, SELECTORS.facebookContinueSelector)
    .catch(() => {});
}

async function clickLoginThenFacebook(page: import("playwright").Page): Promise<void> {
  await acceptCookiesIfPresent(page);

  // Click "Log in" (header link/button varies).
  const loginLink = page.getByRole("link", { name: SELECTORS.loginText }).first();
  const loginButton = page.getByRole("button", { name: SELECTORS.loginText }).first();
  const loginLinkVisible = await loginLink.isVisible().catch(() => false);
  const loginButtonVisible = await loginButton.isVisible().catch(() => false);

  if (loginLinkVisible || loginButtonVisible) {
    console.log('Attempting to click "Log in"...');
    const target = loginLinkVisible ? loginLink : loginButton;
    await target.scrollIntoViewIfNeeded().catch(() => {});
    await target.click({ timeout: 10_000 }).catch((err) => {
      console.log('Click on "Log in" failed (likely overlay).', err);
    });
  } else {
    // Not always present if already on a login route or mid-flow.
    if (!reportedMissingLoginControl) {
      console.log('No visible "Log in" control found on the page (may already be in login flow).');
      reportedMissingLoginControl = true;
    }
  }

  // Then click "Continue with Facebook" (your provided markup uses `id="signInFB"`).
  const fb =
    page
      .locator(SELECTORS.facebookContinueSelector)
      .first()
      .or(page.getByRole("link", { name: SELECTORS.facebookContinueText }).first())
      .or(page.getByRole("button", { name: SELECTORS.facebookContinueText }).first());

  // Wait briefly for the login modal to appear after clicking Log in.
  await fb.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  const fbVisible = await fb.isVisible().catch(() => false);
  if (!fbVisible) {
    // The modal might not have opened yet, or SpareRoom may have changed markup.
    return;
  }

  // Facebook auth may open in a popup, or navigate the same tab.
  // We also attempt to force the flow into the same tab.
  await forceFacebookAuthToSameTab(page).catch(() => {});

  const popupPromise = page.waitForEvent("popup", { timeout: 3_000 }).catch(() => null);
  console.log('Clicking "Continue with Facebook"...');
  await fb.scrollIntoViewIfNeeded().catch(() => {});
  await fb.click({ timeout: 10_000 }).catch((err) => {
    console.log('Click on "Continue with Facebook" failed.', err);
  });
  const popup = await popupPromise;

  // Prefer staying in the first tab.
  // If a popup still appears, redirect the first tab to the popup URL and close the popup.
  let fbAuthPage: import("playwright").Page = page;
  if (popup) {
    await popup.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});
    const popupUrl = popup.url();
    console.log("Facebook opened a new tab; continuing in the original tab instead.");
    await popup.close().catch(() => {});
    if (popupUrl && /facebook\.com/i.test(popupUrl)) {
      await page.goto(popupUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
    }
    fbAuthPage = page;
  } else {
    console.log("Facebook login continuing in the original tab.");
  }

  // Cookie prompt, "continue as ...", then credential fill (if needed).
  await acceptCookiesIfPresent(fbAuthPage).catch(() => {});
  await clickFacebookContinueAsIfPresent(fbAuthPage).catch(() => {});
  await tryFacebookPopupCredentialLogin(fbAuthPage).catch(() => {});
  await clickFacebookContinueAsIfPresent(fbAuthPage).catch(() => {});
}

async function main(): Promise<void> {
  // For login, prefer a visible browser window.
  if (!process.env.FORCE_HEADLESS && !process.env.FORCE_HEADED) {
    process.env.FORCE_HEADED = "1";
  }

  const context = await launchPersistentContext();
  const page = await context.newPage();

  const homeUrl = absoluteUrl(CONFIG.baseUrl, "/");
  const savedUrl = absoluteUrl(CONFIG.baseUrl, CONFIG.savedSearchesPath);
  const postLoginUrl = CONFIG.postLoginUrl;
  console.log(`Opening homepage: ${homeUrl}`);

  try {
    // Start from the homepage (more reliable "Log in" entry point).
    await page.goto(homeUrl, { waitUntil: "domcontentloaded" });

    console.log('If needed, I will click "Log in" then "Continue with Facebook".');
    console.log('Waiting for "Log out" to appear (confirms you are logged in)...');

    // Give plenty of time for manual login.
    const deadlineMs = 5 * 60 * 1000;
    const start = Date.now();
    // Poll because some login flows involve redirects/SPA transitions.
    while (Date.now() - start < deadlineMs) {
      try {
        await assertLoggedIn(page);
        console.log("Logged in confirmed. Persistent session saved to `user_data/`.");
        // Confirm we can access the saved searches page once authenticated.
        await page.goto(savedUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
        if (postLoginUrl) {
          await page.goto(postLoginUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
        }
        await context.close();
        return;
      } catch {
        // Not logged in yet — try the Facebook shortcut once in a while, then keep waiting.
      }

      // Best-effort: attempt to kick off Facebook login (safe no-op if already on FB flow).
      await clickLoginThenFacebook(page).catch(() => {});
      if (page.isClosed()) {
        throw new Error("Browser/page was closed during login. Re-run `npm run login`.");
      }
      await page.waitForTimeout(1000).catch(() => {});
    }

    // Last attempt and snapshot for debugging.
    await saveDebugArtifacts({ page, label: "login-timeout" });
    throw new Error('Login timed out (did not detect visible "Log out").');
  } finally {
    await context.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
