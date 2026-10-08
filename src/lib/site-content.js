/**
 * Server-side loader for admin-managed site content:
 *   site_settings → editable texts/URLs, Coming Soon switch, theme colors, CSS
 *   social_links  → footer social icons
 *   footer_badges → partner / award badges under the footer columns
 *
 * Never throws: on any error the site renders with built-in defaults.
 */
import { cache } from 'react';
import { cachedRead } from '@/lib/db/cached';
import { LIVE } from '@/lib/siteConfig';

const EMPTY_CONTENT = {
  settings: {},
  socialLinks: [],
  footerBadges: { footerExplore: [], footerCompany: [] },
  available: false,
};

const loadSiteContent = cachedRead(
  async (db) => {
    const [settingsRes, socialsRes, badgesRes] = await Promise.all([
      db.from('site_settings').select('key, value'),
      db.from('social_links').select('*').eq('enabled', true).order('sort_order', { ascending: true }),
      db.from('footer_badges').select('*').eq('enabled', true).order('sort_order', { ascending: true }),
    ]);
    const failed = settingsRes.error || socialsRes.error || badgesRes.error;
    if (failed) throw new Error(failed.message);

    const settings = {};
    for (const row of settingsRes.data ?? []) {
      if (row.value != null) settings[row.key] = row.value;
    }
    const badges = badgesRes.data ?? [];
    return {
      settings,
      socialLinks: socialsRes.data ?? [],
      footerBadges: {
        footerExplore: badges.filter((b) => b.location === 'footer_explore'),
        footerCompany: badges.filter((b) => b.location === 'footer_company'),
      },
      available: true,
    };
  },
  ['site-content'],
  { tags: ['site-content'] }
);

export const getSiteContent = cache(async function getSiteContent() {
  return (await loadSiteContent()) ?? EMPTY_CONTENT;
});

/**
 * Is the Coming Soon landing switched on?
 * The admin toggle (site_settings.coming_soon) wins; when it has never been
 * set, the LIVE constant in src/lib/siteConfig.js decides.
 */
export function isComingSoon(settings) {
  const v = settings?.coming_soon;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return !LIVE;
}

/** settings[key] if it is a non-empty string, otherwise the fallback. */
export function setting(settings, key, fallback = '') {
  const v = settings?.[key];
  return typeof v === 'string' && v.trim() !== '' ? v : fallback;
}
