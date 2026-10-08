/**
 * Visible homepage blocks managed at /admin/homepage. They render in the
 * homepage between the built-in Famies sections. Empty array on any error.
 */
import { cachedRead } from '@/lib/db/cached';

export const BLOCK_TYPES = ['heading', 'rich-text', 'image', 'two-column', 'visual-break', 'cta-box', 'feature-grid'];

const loadBlocks = cachedRead(
  async (db) => {
    const { data, error } = await db
      .from('homepage_blocks')
      .select('*')
      .eq('visible', true)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ['homepage-blocks'],
  { tags: ['homepage-blocks'] }
);

export async function getHomepageBlocks() {
  return (await loadBlocks()) ?? [];
}
