/**
 * Admin-managed menus for the header and footer (table menu_items).
 *
 * Locations:
 *   header          → main Navbar links
 *   footer_explore  → first footer column ("Utforska")
 *   footer_company  → second footer column ("Support")
 *   footer_bottom   → small links in the footer's bottom bar
 *
 * Returns the built-in Famies menus when the table is empty or unreachable,
 * so the site never loses its navigation.
 */
import { cache } from 'react';
import { cachedRead } from '@/lib/db/cached';

import { DEFAULT_MENUS } from '@/lib/menu-defaults';

export { DEFAULT_MENUS };

const loadMenus = cachedRead(
  async (db) => {
    const { data, error } = await db
      .from('menu_items')
      .select('id, location, label, url, target, sort_order')
      .eq('enabled', true)
      .order('sort_order', { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ['menus'],
  { tags: ['menus'] }
);

export const getMenus = cache(async function getMenus() {
  const data = await loadMenus();
  if (!data || data.length === 0) return DEFAULT_MENUS;
  return {
    header: data.filter((m) => m.location === 'header'),
    footerExplore: data.filter((m) => m.location === 'footer_explore'),
    footerCompany: data.filter((m) => m.location === 'footer_company'),
    footerBottom: data.filter((m) => m.location === 'footer_bottom'),
  };
});
