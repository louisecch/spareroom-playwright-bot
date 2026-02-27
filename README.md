# SpareRoom Playwright Bot (TypeScript)

Since ghosting is common on this platform as well, why not be a ghost yourself too? 👀

This project uses a **persistent Playwright profile** (`user_data/`) so you only log in once, then it can:

- Scrape your **saved search results** page(s) for listings marked **“New today”**
- Deduplicate by Ad ID using `data/messaged_ads.json`
- Open each listing and prepare a message (with template rotation + poster-name personalization)

## Quick start

### 1) Install

```bash
npm install
```

### 2) One-time manual login (persisted to `user_data/`)

```bash
npm run login
```

- A real Chromium window opens.
- Log in normally.
- The script will confirm you're logged in (it checks the account area / logout link).
- After login, it will try to click **Saved searches** and leave the browser open so you can inspect selectors.
- Optional: you can set `FB_EMAIL` / `FB_PASSWORD` in `.env` to auto-fill credentials in the Facebook popup (2FA/checkpoints still require manual steps).

### 3) Run once (debug)

```bash
npm run once
```

By default, the bot runs in **preview mode** (it fills the message but does **not** click **Send**).
To actually send messages:

```bash
SEND_MESSAGES=1 npm run once
```

`npm run once` also leaves the browser open at the end (so you can inspect the filled message). Press **Ctrl+C** in the terminal when you're done.

### 4) Run continuously (once per day at a random time)

```bash
npm run start
```

## Notes

- Persistent session is stored in `user_data/` (do not delete unless you want to re-login).
- Deduplication store is `data/messaged_ads.json`.
- If SpareRoom changes UI selectors, check logs + artifacts in `debug/` (screenshots + HTML snapshots).
- Saved searches hub page is currently `https://www.spareroom.co.uk/flatshare/savesearch.pl`.
- Target saved search results URL(s) are configured in `src/config.ts` as `targetSearchResultUrls` (example: `https://www.spareroom.co.uk/flatshare/index.cgi?search_id=...`).
- Random delays between actions are controlled by `minDelayMs` / `maxDelayMs` in `src/config.ts`.
- Daily random scheduler window is controlled by `dailyRunWindowStartMinute` / `dailyRunWindowEndMinute` in `src/config.ts`.

## Common commands

```bash
# one-time login (persistent profile in ./user_data)
npm run login

# one-shot run (fills message, no send by default)
npm run once

# one-shot run that actually sends messages
SEND_MESSAGES=1 npm run once

# daily random schedule
npm run start
```

## Demo

https://github.com/user-attachments/assets/a70c36fe-2bfb-4d1b-bf71-b61904c6d43c
