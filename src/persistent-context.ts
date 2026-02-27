import { chromium, type BrowserContext, type Page } from "playwright";

type LaunchPersistentContextOptions = NonNullable<Parameters<typeof chromium.launchPersistentContext>[1]>;

export type PersistentContext = {
  context: BrowserContext;
  page: Page;
  profileDir: string;
};

function envBool(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim();
  if (!raw) return defaultValue;
  return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "yes";
}

export async function launchSpareroomPersistentContext(
  options: Omit<LaunchPersistentContextOptions, "headless"> & { headless?: boolean } = {},
): Promise<PersistentContext> {
  const profileDir = process.env.SPAREROOM_PROFILE_DIR?.trim() || "user_data/spareroom";
  const headless = options.headless ?? envBool("HEADLESS", false);

  const context = await chromium.launchPersistentContext(profileDir, {
    ...options,
    headless,
  });

  const page = context.pages()[0] ?? (await context.newPage());
  return { context, page, profileDir };
}
