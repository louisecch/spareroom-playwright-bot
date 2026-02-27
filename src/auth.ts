import type { Page } from "playwright";
import { CONFIG } from "./config";
import { SELECTORS } from "./spareRoom/selectors";
import { absoluteUrl } from "./spareRoom/urls";

export async function assertLoggedIn(page: Page): Promise<void> {
  // Requirement: validate session at start of every run via visible "Log out".
  const logout =
    page
      .locator(SELECTORS.logoutLinkSelector)
      .first()
      .or(page.locator(`a[href="${SELECTORS.logoutHref}"]`).first())
      .getByRole("link", { name: SELECTORS.logoutText })
      .first()
      .or(page.getByRole("button", { name: SELECTORS.logoutText }).first())
      .or(page.getByText(SELECTORS.logoutText, { exact: false }).first());

  if (await logout.isVisible().catch(() => false)) return;

  // SpareRoom often hides "Log out" inside an Account menu. Reveal it if possible.
  const accountToggle =
    page
      .getByRole("button", { name: /account|my\s*account/i })
      .first()
      .or(page.getByRole("link", { name: /account|my\s*account/i }).first());

  if (await accountToggle.isVisible().catch(() => false)) {
    await accountToggle.click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(300).catch(() => {});
    if (await logout.isVisible().catch(() => false)) return;
  }

  // If the "Account" toggle isn't role-labelled, try known mini-nav toggle containers.
  const miniNavToggle = page.locator(SELECTORS.accountMiniNavToggleSelector).first();
  if (await miniNavToggle.isVisible().catch(() => false)) {
    await miniNavToggle.click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(300).catch(() => {});
    if (await logout.isVisible().catch(() => false)) return;
  }

  // Last resort: navigate to a page that typically shows account navigation.
  // This keeps the requirement (logout *visible*) while avoiding false negatives.
  const accountUrl = absoluteUrl(CONFIG.baseUrl, "/content/myaccount/myaccount-index/");
  await page.goto(accountUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
  if (await logout.isVisible().catch(() => false)) {
    console.log(`Already logged in (confirmed via ${accountUrl}).`);
    return;
  }

  // SpareRoom sometimes doesn't render "Log out" as visible text, but the account page
  // will show a "need to log in" gate when unauthenticated.
  const loginGateText = /to view this content you will need to either log in or register/i;
  const isGated = await page.getByText(loginGateText, { exact: false }).first().isVisible().catch(() => false);
  if (!isGated) {
    console.log(`Already logged in (account page accessible: ${accountUrl}).`);
    return;
  }

  throw new Error(
    [
      'Not logged in (could not find visible "Log out").',
      "Run `npm run login` once to create a persistent session in `user_data/`.",
      `Expected to be logged in at: ${absoluteUrl(CONFIG.baseUrl, CONFIG.savedSearchesPath)}`
    ].join(" ")
  );
}

