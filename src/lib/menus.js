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
import { createPublicClient } from '@/lib/supabase/public';

const item = (location, label, url) => ({ id: `${location}-${url}`, location, label, url, target: '_self' });

export const DEFAULT_MENUS = {
  header: [
    item('header', 'Hem', '/'),
    item('header', 'Inspiration', '/inspiration'),
    item('header', 'Skapa event', '/skapa-event'),
    item('header', 'Kontakt', '/contact'),
  ],
  footerExplore: [
    item('footer_explore', 'Hem', '/'),
    item('footer_explore', 'Så funkar det', '/#how'),
    item('footer_explore', 'Funktioner', '/#features'),
    item('footer_explore', 'Recensioner', '/#reviews'),
    item('footer_explore', 'Inspiration', '/inspiration'),
    item('footer_explore', 'Skapa event', '/skapa-event'),
  ],
  footerCompany: [
    item('footer_company', 'Kontakt', '/contact'),
    item('footer_company', 'Privacy Policy', '/privacy'),
    item('footer_company', 'Terms of Use', '/terms'),
    item('footer_company', 'Account Deletion Manual', '/deletion'),
  ],
  footerBottom: [],
};

export const getMenus = cache(async function getMenus() {
  const supabase = createPublicClient({ tags: ['menus'] });
  if (!supabase) return DEFAULT_MENUS;

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('id, location, label, url, target, sort_order')
      .eq('enabled', true)
      .order('sort_order', { ascending: true });

    if (error || !data) {
      if (error) console.error('[menus] fetch error:', error.message);
      return DEFAULT_MENUS;
    }
    if (data.length === 0) return DEFAULT_MENUS;

    return {
      header: data.filter((m) => m.location === 'header'),
      footerExplore: data.filter((m) => m.location === 'footer_explore'),
      footerCompany: data.filter((m) => m.location === 'footer_company'),
      footerBottom: data.filter((m) => m.location === 'footer_bottom'),
    };
  } catch (err) {
    console.error('[menus] unexpected error:', err?.message || err);
    return DEFAULT_MENUS;
  }
});
