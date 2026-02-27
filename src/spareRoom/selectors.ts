/**
 * Selectors are intentionally centralized here so UI drift is easy to fix.
 *
 * Preference order:
 * - Role/text-based selectors (more robust)
 * - CSS selectors for structure
 * - XPath (for "New today" label requirement and when necessary)
 */
export const SELECTORS = {
  // Session validation: must see a logout control when logged in.
  // We intentionally use a text-based locator rather than a brittle CSS selector.
  logoutText: /log\s*out/i,
  // You provided the logout link markup; this is a stable, high-signal selector.
  logoutHref: "/flatshare/logout.pl",
  logoutLinkSelector:
    'a.account-mini-nav__menu-item[href="/flatshare/logout.pl"], a[href="/flatshare/logout.pl"], a[href*="logout.pl"]',

  // Account menu toggles (to reveal the expandable mini-nav that contains "Log out").
  // These are best-effort fallbacks; the role-based "Account" toggle is still preferred.
  accountMiniNavToggleSelector:
    '.account-mini-nav__toggle, .account-mini-nav [aria-haspopup="menu"], .account-mini-nav button, .account-mini-nav a',

  // Login entry points.
  loginText: /log\s*in|sign\s*in/i,
  facebookContinueSelector: "#signInFB",
  facebookContinueText: /continue\s+with\s+facebook/i,

  // Saved searches page.
  savedSearchLinkToResults: /view\s*matches|view\s*results|view/i,
  savedSearchesNavText: /saved\s+searches/i,

  // "New today" label — requirement explicitly calls out CSS/XPath.
  // This XPath matches any element whose text contains "New today" (case sensitive-ish via normalize-space).
  // If SpareRoom changes this label, update here.
  newTodayXPath: 'xpath=//*[contains(normalize-space(.), "New today")]',

  // Ad detail URLs typically contain `flatshare_id=1234567`.
  adIdParam: "flatshare_id",

  // Contact controls on an ad detail page.
  emailAdvertiserText: /email\s+advertiser|message\s+advertiser|contact\s+advertiser/i,

  // Common send button text.
  sendButtonText: /send/i
} as const;

