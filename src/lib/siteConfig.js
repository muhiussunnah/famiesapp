/**
 * Famies site mode — default when the admin switch has never been used.
 *
 * Two ways to bring back the "Coming Soon" landing (logo + store badges):
 *   1. Instantly, no deploy: /admin → Dashboard → "Coming Soon mode" ON.
 *      (stored in site_settings.coming_soon, which overrides this file)
 *   2. In code: set LIVE = false and redeploy.
 *
 * LIVE = true shows the full website (Hero, PainPoints, HowItWorks,
 * Features, SocialProof, Download, Blog, Newsletter, Navbar, Footer).
 * The Coming Soon page itself lives in src/components/ComingSoon.js.
 */
export const LIVE = true;
