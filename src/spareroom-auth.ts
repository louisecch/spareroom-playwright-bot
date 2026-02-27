import type { Page } from "playwright";

export async function isLoggedIn(page: Page): Promise<boolean> {
  const loginLink = page.getByRole("link", { name: /log in/i });
  const hasLoginLink = await loginLink.isVisible().catch(() => false);
  return !hasLoginLink;
}

export async function assertLoggedIn(page: Page): Promise<void> {
  if (await isLoggedIn(page)) return;
  throw new Error(
    'Not logged in. Run `npm run login` once (with a visible browser) to create a persistent session in `user_data/spareroom`, then re-run.',
  );
}
