import path from "node:path";

/**
 * Centralized configuration.
 * Keep selectors in `src/spareRoom/selectors.ts`.
 */
export const CONFIG = {
  // Use HTTPS and the canonical domain.
  baseUrl: "https://www.spareroom.co.uk",

  // Key requirement: scrape your Saved Search area as the entry point.
  // We'll navigate here every run.
  savedSearchesPath: "/content/myaccount/savedsearches/",

  // Optional: after login is confirmed, navigate here (useful for verifying a specific saved search).
  postLoginUrl:
    "https://www.spareroom.co.uk/flatshare/index.cgi?search_id=1418338503&search_type=offered&mode=edit&editing=1418338503",

  // Persistent browser profile directory (cookies / session tokens).
  userDataDir: path.resolve(process.cwd(), "user_data"),

  // Local JSON store of ad IDs already messaged.
  messagedAdsPath: path.resolve(process.cwd(), "data", "messaged_ads.json"),

  // Debug artifacts on errors / selector drift.
  debugDir: path.resolve(process.cwd(), "debug"),

  // Rotate 3–5 templates to reduce spam detection risk.
  // Keep these short, human, and varied. Avoid URLs.
  messageTemplates: [
    "Hi! I saw your ad and I’m interested. Could you share a bit more about the room/flat and the move-in flexibility? Thanks!",
    "Hey there — your place looks like a good fit for me. Is it still available, and when would viewings be possible?",
    "Hi, I’m looking for a place in the area and your listing caught my eye. Can I ask if it’s still available and what the next steps are?",
    "Hello! I’m interested in the room. What’s the earliest move-in date, and is there a best time for a quick viewing this week?",
    "Hi — I’m keen on the room and happy to share details about myself. Is it still available, and what’s the preferred way to arrange a viewing?"
  ],

  // Anti-detection: set a modern, consistent UA (Chrome on macOS).
  // Keep it stable across runs for the same profile.
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",

  // Random delays: 3–8 seconds (in ms).
  minDelayMs: 3_000,
  maxDelayMs: 8_000,

  // Scheduler: run exactly on the hour + half-hour.
  cron: "0,30 * * * *",

  // Headless-drop: occasionally run headed to detect CAPTCHAs.
  headedProbability: 0.15
} as const;

