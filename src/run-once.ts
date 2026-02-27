import { CONFIG } from "./config";
import { launchPersistentContext, saveDebugArtifacts } from "./browser";
import { assertLoggedIn } from "./auth";
import { scrapeNewTodayFromSavedSearches } from "./spareRoom/scrape";
import { loadMessagedAdsStore, saveMessagedAdsStore } from "./utils/messagedAdsStore";
import { messageAd } from "./spareRoom/message";
import { randomDelay } from "./utils/delay";

export async function runOnce(): Promise<void> {
  const store = await loadMessagedAdsStore(CONFIG.messagedAdsPath);
  const context = await launchPersistentContext();
  const page = await context.newPage();

  try {
    console.log("Validating session...");
    await page.goto(CONFIG.baseUrl, { waitUntil: "domcontentloaded" });
    await assertLoggedIn(page);

    console.log("Scraping Saved Searches for 'New today' ads...");
    const scraped = await scrapeNewTodayFromSavedSearches({
      page,
      baseUrl: CONFIG.baseUrl,
      savedSearchesPath: CONFIG.savedSearchesPath
    });

    const candidates = scraped.filter((ad) => !store.ads[ad.adId]);
    console.log(`Found ${scraped.length} new-today ads; ${candidates.length} not yet messaged.`);

    for (const ad of candidates) {
      console.log(`Opening adId=${ad.adId} ${ad.url}`);
      await randomDelay(CONFIG.minDelayMs, CONFIG.maxDelayMs);
      await page.goto(ad.url, { waitUntil: "domcontentloaded" });

      try {
        const { result, templateIndex } = await messageAd({
          page,
          adId: ad.adId,
          templates: CONFIG.messageTemplates
        });

        if (result.status === "sent") {
          console.log(`Sent message to adId=${ad.adId} (template #${templateIndex}).`);
          store.ads[ad.adId] = {
            firstMessagedAtIso: new Date().toISOString(),
            url: ad.url,
            messageTemplateIndex: templateIndex
          };
          await saveMessagedAdsStore(CONFIG.messagedAdsPath, store);
        } else {
          console.log(`Skipped adId=${ad.adId}: ${result.reason}`);
        }
      } catch (err) {
        console.error(`Error messaging adId=${ad.adId}:`, err);
        const artifacts = await saveDebugArtifacts({ page, label: `message-error-${ad.adId}` });
        console.error("Saved debug artifacts:", artifacts);
      }
    }
  } catch (err) {
    console.error("Run failed:", err);
    const artifacts = await saveDebugArtifacts({ page, label: "run-failed" });
    console.error("Saved debug artifacts:", artifacts);
  } finally {
    await context.close().catch(() => {});
  }
}

// Allow running directly via `npm run once`.
if (require.main === module) {
  runOnce().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
