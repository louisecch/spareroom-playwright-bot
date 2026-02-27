import { CONFIG } from "./config";
import { runOnce } from "./run-once";

/**
 * Runs the bot once per day, at a randomized time.
 *
 * This file calls `runOnce()` for the implementation and schedules it.
 * We keep the schedule wrapper tiny to reduce failure surface area.
 */

async function safeRun(label: string): Promise<void> {
  // Global catch: don't crash the process if a selector changes.
  try {
    console.log(`[${new Date().toISOString()}] Run started (${label})`);
    await runOnce();
    console.log(`[${new Date().toISOString()}] Run finished (${label})`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Run failed (${label}):`, err);
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function randomIntInclusive(min: number, max: number): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function pickRandomMinuteOfDay(): number {
  const start = clamp(CONFIG.dailyRunWindowStartMinute, 0, 24 * 60 - 1);
  const end = clamp(CONFIG.dailyRunWindowEndMinute, 0, 24 * 60 - 1);
  return randomIntInclusive(start, end);
}

function computeNextRunAt(): Date {
  const now = new Date();
  const minuteOfDay = pickRandomMinuteOfDay();

  const target = new Date(now);
  target.setHours(0, 0, 0, 0);
  target.setMinutes(minuteOfDay);

  // If the random time already passed today, schedule for tomorrow.
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

async function scheduleForever(): Promise<void> {
  // We schedule exactly one run at a time, then re-schedule after it completes.
  // This avoids drift and makes it easy to change the window later.
  while (true) {
    const nextAt = computeNextRunAt();
    const delayMs = Math.max(0, nextAt.getTime() - Date.now());

    const hh = String(nextAt.getHours()).padStart(2, "0");
    const mm = String(nextAt.getMinutes()).padStart(2, "0");
    console.log(
      `[${new Date().toISOString()}] Next daily run scheduled for ${nextAt.toDateString()} ${hh}:${mm} (in ${Math.round(
        delayMs / 1000
      )}s)`
    );

    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    await safeRun("daily-random");
  }
}

async function main(): Promise<void> {
  console.log("Scheduling: once per day at a randomized time.");
  await scheduleForever();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
