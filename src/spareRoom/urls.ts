import { SELECTORS } from "./selectors";

export function absoluteUrl(baseUrl: string, maybePathOrUrl: string): string {
  try {
    return new URL(maybePathOrUrl, baseUrl).toString();
  } catch {
    // Fallback: best-effort join
    if (maybePathOrUrl.startsWith("http")) return maybePathOrUrl;
    const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    const path = maybePathOrUrl.startsWith("/") ? maybePathOrUrl : `/${maybePathOrUrl}`;
    return base + path;
  }
}

export function extractAdIdFromUrl(urlString: string): string | null {
  try {
    const u = new URL(urlString);
    const id = u.searchParams.get(SELECTORS.adIdParam);
    return id && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
}

