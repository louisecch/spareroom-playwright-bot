import cron from "node-cron";
import { CONFIG } from "./config";
import { runOnce } from "./run-once";

/**
 * Runs the bot on an exact 30-minute schedule.
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

async function main(): Promise<void> {
  console.log(`Scheduling: "${CONFIG.cron}" (runs at :00 and :30).`);

  // Run immediately once at startup.
  void safeRun("startup");

  cron.schedule(
    CONFIG.cron,
    async () => {
      void safeRun("scheduled");
    },
    { timezone: "Europe/London" }
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
