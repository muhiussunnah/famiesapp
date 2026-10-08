/**
 * Enabled custom scripts (Google Analytics, Search Console verification,
 * Meta Pixel …) managed at /admin/header-scripts.
 */
import { cache } from 'react';
import { cachedRead } from '@/lib/db/cached';

const loadScripts = cachedRead(
  async (db) => {
    const { data, error } = await db
      .from('site_scripts')
      .select('id, name, code, position, sort_order')
      .eq('enabled', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ['site-scripts'],
  { tags: ['site-scripts'] }
);

export const getEnabledScripts = cache(async function getEnabledScripts() {
  return (await loadScripts()) ?? [];
});

export function groupByPosition(scripts) {
  return {
    head: scripts.filter((s) => s.position === 'head'),
    bodyStart: scripts.filter((s) => s.position === 'body_start'),
    bodyEnd: scripts.filter((s) => s.position === 'body_end'),
  };
}
