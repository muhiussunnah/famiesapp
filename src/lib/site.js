/**
 * Site-wide constants shared by the public site, the admin panel and the
 * Writerfy publishing API.
 */

// Canonical origin. www.famies.app does not serve HTTPS, so every absolute
// URL (canonical, sitemap, Open Graph, Writerfy responses) uses the apex.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://famies.app').replace(/\/+$/, '');

export const SITE_NAME = 'Famies';

// Article categories — same list the old Content Studio used.
export const CATEGORIES = [
  'Bebis & Du',
  'Familjeliv & Pepp',
  'Fira & Njuta',
  'Lär & Utforska',
  'Lek & Fart',
  'Mat & Mums',
  'Mys & Hitta på',
  'Ses & Hitta på',
  'Tillgängligt för alla',
  'Utflykter & Kul',
  'Ut & Upptäck',
];

export const DEFAULT_CATEGORY = 'Familjeliv & Pepp';
export const DEFAULT_AUTHOR_NAME = 'Famies redaktion';
export const DEFAULT_AUTHOR_ROLE = 'Familjetips från Famies';

// Where the blog listing lives. Articles themselves live at /<slug>.
export const BLOG_PATH = '/inspiration';

/** Absolute URL for a stored slug ("/my-post" → "https://famies.app/my-post"). */
export function absoluteUrl(path = '/') {
  return SITE_URL + (path.startsWith('/') ? path : '/' + path);
}
