import pg from 'pg';

/**
 * Shared PostgreSQL connection pool (DATABASE_URL).
 *
 * Returns null when no database is configured, and during `next build`
 * (the database container is not reachable while Docker builds the image),
 * so every caller falls back to the site's built-in content instead of
 * hanging or crashing.
 */

// Timestamps come back as ISO strings (like the Supabase API did) instead
// of Date objects, and bigint counts as numbers.
const parseTimestamptz = pg.types.getTypeParser(1184);
const parseTimestamp = pg.types.getTypeParser(1114);
pg.types.setTypeParser(1184, (v) => {
  const d = parseTimestamptz(v);
  return d instanceof Date && !isNaN(d) ? d.toISOString() : v;
});
pg.types.setTypeParser(1114, (v) => {
  const d = parseTimestamp(v);
  return d instanceof Date && !isNaN(d) ? d.toISOString() : v;
});
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

export function hasDatabase() {
  return !!process.env.DATABASE_URL && process.env.NEXT_PHASE !== 'phase-production-build';
}

export function getPool() {
  if (!hasDatabase()) return null;
  // Survive dev hot reloads without opening a new pool each time.
  if (!globalThis.__famiesPgPool) {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 10),
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      query_timeout: 20000,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
    pool.on('error', (err) => console.error('[db] idle client error:', err.message));
    globalThis.__famiesPgPool = pool;
  }
  return globalThis.__famiesPgPool;
}
