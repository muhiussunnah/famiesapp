/**
 * Visible homepage blocks managed at /admin/homepage. They render in the
 * homepage between the built-in Famies sections. Empty array on any error.
 */
import { createPublicClient } from '@/lib/supabase/public';

export const BLOCK_TYPES = ['heading', 'rich-text', 'image', 'two-column', 'visual-break', 'cta-box', 'feature-grid'];

export async function getHomepageBlocks() {
  const supabase = createPublicClient({ tags: ['homepage-blocks'] });
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('homepage_blocks')
      .select('*')
      .eq('visible', true)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[homepage-blocks] fetch error:', error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.error('[homepage-blocks] unexpected error:', err?.message || err);
    return [];
  }
}
