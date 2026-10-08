/**
 * Enabled custom scripts (Google Analytics, Search Console verification,
 * Meta Pixel …) managed at /admin/header-scripts. RLS only exposes
 * enabled rows to the anon key.
 */
import { cache } from 'react';
import { createPublicClient } from '@/lib/supabase/public';

export const getEnabledScripts = cache(async function getEnabledScripts() {
  const supabase = createPublicClient({ tags: ['site-scripts'] });
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('site_scripts')
      .select('id, name, code, position, sort_order')
      .eq('enabled', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[site-scripts] fetch error:', error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.error('[site-scripts] unexpected error:', err?.message || err);
    return [];
  }
});

export function groupByPosition(scripts) {
  return {
    head: scripts.filter((s) => s.position === 'head'),
    bodyStart: scripts.filter((s) => s.position === 'body_start'),
    bodyEnd: scripts.filter((s) => s.position === 'body_end'),
  };
}
