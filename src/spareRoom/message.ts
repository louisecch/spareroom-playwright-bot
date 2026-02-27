import type { Page } from "playwright";
import { SELECTORS } from "./selectors";
import { randomDelay } from "../utils/delay";
import { CONFIG } from "../config";

export type MessageResult =
  | { status: "sent" }
  | { status: "skipped"; reason: string };

function pickTemplateIndex(adId: string, templatesCount: number): number {
  // Deterministic rotation per adId to keep behavior stable across retries.
  let hash = 0;
  for (let i = 0; i < adId.length; i++) hash = (hash * 31 + adId.charCodeAt(i)) >>> 0;
  return templatesCount === 0 ? 0 : hash % templatesCount;
}

async function clickEmailAdvertiserIfPresent(page: Page): Promise<boolean> {
  // Preferred: the listing details page has a dedicated "Message" CTA that navigates
  // to the contact-by-email form (you provided exact markup pattern).
  const listingMessageLink = page.locator(SELECTORS.listingMessageButtonSelector).first();
  if (await listingMessageLink.isVisible().catch(() => false)) {
    await randomDelay(CONFIG.minDelayMs, CONFIG.maxDelayMs);
    await listingMessageLink.click().catch(() => {});
    return true;
  }

  const button = page.getByRole("button", { name: SELECTORS.emailAdvertiserText }).first();
  const link = page.getByRole("link", { name: SELECTORS.emailAdvertiserText }).first();

  if (await button.isVisible().catch(() => false)) {
    await randomDelay(CONFIG.minDelayMs, CONFIG.maxDelayMs);
    await button.click();
    return true;
  }
  if (await link.isVisible().catch(() => false)) {
    await randomDelay(CONFIG.minDelayMs, CONFIG.maxDelayMs);
    await link.click();
    return true;
  }
  return false;
}

async function findMessageTextarea(page: Page) {
  // Heuristic: try common message selectors first, then fall back to any textarea in a form.
  const candidates = [
    page.locator('textarea[name="message"]'),
    page.locator('textarea#message'),
    page.locator('form textarea')
  ];
  for (const c of candidates) {
    if (await c.first().isVisible().catch(() => false)) return c.first();
  }
  return page.locator("textarea").first();
}

async function findSendButton(page: Page) {
  // Try role-based first.
  const byRole = page.getByRole("button", { name: SELECTORS.sendButtonText }).first();
  if (await byRole.isVisible().catch(() => false)) return byRole;
  // Fallback to input[type=submit]
  return page.locator('button[type="submit"], input[type="submit"]').first();
}

export async function messageAd(params: {
  page: Page;
  adId: string;
  templates: readonly string[];
}): Promise<{ result: MessageResult; templateIndex: number }> {
  const templateIndex = pickTemplateIndex(params.adId, params.templates.length);
  const message = params.templates[templateIndex] ?? "";

  // If we're already on the contact form (some flows navigate directly), skip the CTA click.
  const textarea = await findMessageTextarea(params.page);
  const visible = await textarea.isVisible().catch(() => false);
  if (!visible) {
    // Conditional handling: some ads are phone-only (no email form).
    const opened = await clickEmailAdvertiserIfPresent(params.page);
    if (!opened) {
      return {
        result: { status: "skipped", reason: "No Message/Email control (likely phone-only)" },
        templateIndex
      };
    }

    await randomDelay(CONFIG.minDelayMs, CONFIG.maxDelayMs);

    const textarea2 = await findMessageTextarea(params.page);
    const visible2 = await textarea2.isVisible().catch(() => false);
    if (!visible2) {
      return {
        result: { status: "skipped", reason: "Message textarea not found/visible (UI may have changed)" },
        templateIndex
      };
    }

    await randomDelay(CONFIG.minDelayMs, CONFIG.maxDelayMs);
    await textarea2.click();
    await randomDelay(CONFIG.minDelayMs, CONFIG.maxDelayMs);
    await textarea2.fill(message);
  } else {
    await randomDelay(CONFIG.minDelayMs, CONFIG.maxDelayMs);
    await textarea.click();
    await randomDelay(CONFIG.minDelayMs, CONFIG.maxDelayMs);
    await textarea.fill(message);
  }

  const send = await findSendButton(params.page);
  if (!(await send.isVisible().catch(() => false))) {
    return {
      result: { status: "skipped", reason: "Send button not found/visible (UI may have changed)" },
      templateIndex
    };
  }

  await randomDelay(CONFIG.minDelayMs, CONFIG.maxDelayMs);
  await send.click();

  // Best-effort confirmation: wait a bit for navigation or success text.
  // Avoid strict waits (UI differs) but reduce false positives.
  await Promise.race([
    params.page.waitForLoadState("networkidle").catch(() => {}),
    params.page.waitForTimeout(5000)
  ]);

  return { result: { status: "sent" }, templateIndex };
}

