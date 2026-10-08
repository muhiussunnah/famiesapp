import { unstable_cache } from 'next/cache';
import { getDb, hasDatabase } from './index';

/**
 * Wrap a public, read-only database query in Next's data cache.
 *
 *   export const getMenus = cachedRead(async (db) => { … return rows; }, ['menus'], { tags: ['menus'] });
 *
 * - Results are cached for `revalidate` seconds and dropped instantly when
 *   the admin API calls revalidateTag(tag) after a write.
 * - `fn` should THROW on a query error, so failures are never cached.
 * - Returns null (never throws) when there is no database or the query
 *   failed; callers then use their built-in fallback content.
 */
export function cachedRead(fn, keyParts, { tags = [], revalidate = 60 } = {}) {
  const cached = unstable_cache(
    async (...args) => {
      const db = getDb();
      if (!db) throw new Error('NO_DATABASE');
      return fn(db, ...args);
    },
    keyParts,
    { tags, revalidate }
  );

  return async (...args) => {
    if (!hasDatabase()) return null;
    try {
      return await cached(...args);
    } catch (err) {
      if (err?.message !== 'NO_DATABASE') console.error(`[db] ${keyParts.join('/')} failed:`, err?.message || err);
      return null;
    }
  };
}
