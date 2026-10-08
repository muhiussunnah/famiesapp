import { getPool, hasDatabase } from './pool';
import { createQueryClient } from './query-builder';
import { storage } from './storage';

export { hasDatabase };

/**
 * The database client (PostgreSQL via DATABASE_URL), or null when no
 * database is configured / during `next build`. Server-only: call it from
 * Route Handlers and Server Components after authorising the caller where
 * needed (admin session, Writerfy token, cron secret).
 *
 *   const db = getDb();
 *   if (!db) return fallback;
 *   const { data, error } = await db.from('menu_items').select('*').eq('enabled', true);
 */
export function getDb() {
  const pool = getPool();
  return pool ? createQueryClient(pool, storage) : null;
}
