import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { BrowserContext, LaunchPersistentContextOptions, Page } from "playwright";

import { CONFIG } from "./config";
import { ensureDir } from "./utils/files";

chromium.use(StealthPlugin());

export function shouldRunHeaded(): boolean {
  // You can override by exporting FORCE_HEADED=1 in your shell.
  if (process.env.FORCE_HEADED === "1") return true;
  if (process.env.FORCE_HEADLESS === "1") return false;
  return Math.random() < CONFIG.headedProbability;
}

export async function launchPersistentContext(): Promise<BrowserContext> {
  await ensureDir(CONFIG.userDataDir);

  const headless = !shouldRunHeaded();

  const opts: LaunchPersistentContextOptions = {
    headless,
    userAgent: CONFIG.userAgent,
    viewport: { width: 1365, height: 900 },
    locale: "en-GB",
    timezoneId: "Europe/London",
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-default-browser-check",
      "--no-first-run"
    ]
  };

  return await chromium.launchPersistentContext(CONFIG.userDataDir, opts);
}

export async function saveDebugArtifacts(params: {
  page: Page;
  label: string;
}): Promise<{ screenshotPath: string; htmlPath: string }> {
  await ensureDir(CONFIG.debugDir);
  const safeLabel = params.label.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 80);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const screenshotPath = path.join(CONFIG.debugDir, `${ts}.${safeLabel}.png`);
  const htmlPath = path.join(CONFIG.debugDir, `${ts}.${safeLabel}.html`);

  await params.page.screenshot({ path: screenshotPath, fullPage: true });
  const html = await params.page.content();
  await fs.writeFile(htmlPath, html, "utf8");

  return { screenshotPath, htmlPath };
}

