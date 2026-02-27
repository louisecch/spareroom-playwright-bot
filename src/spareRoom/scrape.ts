import type { Page } from "playwright";
import { SELECTORS } from "./selectors";
import { absoluteUrl, extractAdIdFromUrl } from "./urls";

export type ScrapedAd = {
  adId: string;
  url: string;
};

/**
 * Entry point scraping:
 * - Navigate to Saved Searches page
 * - From there, click into "view matches/results" for each saved search
 * - On each results page, collect "New today" ads via XPath label matching
 *
 * This minimizes site-wide crawling: we only traverse your saved searches and their results.
 */
export async function scrapeNewTodayFromSavedSearches(params: {
  page: Page;
  baseUrl: string;
  savedSearchesPath: string;
}): Promise<ScrapedAd[]> {
  const { page } = params;
  const savedUrl = absoluteUrl(params.baseUrl, params.savedSearchesPath);

  await page.goto(savedUrl, { waitUntil: "domcontentloaded" });

  // Collect saved search result links. SpareRoom’s markup may change; we bias to role/text.
  // This may include duplicates; we'll dedupe later.
  const candidates = page.getByRole("link", { name: SELECTORS.savedSearchLinkToResults }).or(
    page.locator('a:has-text("View")')
  );

  const hrefs = await candidates.evaluateAll((els) =>
    els
      .map((el) => (el instanceof HTMLAnchorElement ? el.href : null))
      .filter((x): x is string => !!x)
  );

  const uniqueSearchUrls = Array.from(new Set(hrefs)).map((u) => absoluteUrl(params.baseUrl, u));

  const ads: ScrapedAd[] = [];
  for (const searchUrl of uniqueSearchUrls) {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });

    // Requirement: isolate "New today" labels using CSS selector or XPath.
    // We use XPath to locate the label and then find an ancestor container with an ad link.
    const linkLocator = page.locator(
      `${SELECTORS.newTodayXPath}/ancestor::*[self::li or self::article or self::div][1]//a[contains(@href,"${SELECTORS.adIdParam}=")]`
    );

    const adHrefs = await linkLocator.evaluateAll((els) =>
      els
        .map((el) => (el instanceof HTMLAnchorElement ? el.href : null))
        .filter((x): x is string => !!x)
    );

    for (const href of adHrefs) {
      const abs = absoluteUrl(params.baseUrl, href);
      const adId = extractAdIdFromUrl(abs);
      if (adId) ads.push({ adId, url: abs });
    }
  }

  // Dedupe by adId (some pages have multiple links per card).
  const seen = new Set<string>();
  const out: ScrapedAd[] = [];
  for (const ad of ads) {
    if (seen.has(ad.adId)) continue;
    seen.add(ad.adId);
    out.push(ad);
  }
  return out;
}

