// Applies db/schema.sql to DATABASE_URL. Idempotent; run on every container
// start (see Dockerfile) and by hand with `npm run db:migrate`.
// Retries for a while so the app can start before Postgres is ready.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('[migrate] DATABASE_URL not set — skipping.');
  process.exit(0);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = await readFile(path.join(here, '..', 'db', 'schema.sql'), 'utf8');

for (let attempt = 1; attempt <= 30; attempt++) {
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await client.connect();
    await client.query('begin');
    await client.query(schema);
    await client.query('commit');
    await client.end();
    console.log('[migrate] schema up to date.');
    process.exit(0);
  } catch (err) {
    await client.query('rollback').catch(() => {});
    await client.end().catch(() => {});
    const retryable = /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|timeout|starting up|terminat/i.test(err.message);
    if (!retryable || attempt === 30) {
      console.error(`[migrate] failed: ${err.message}`);
      process.exit(1);
    }
    console.log(`[migrate] database not ready (${err.message}) — retry ${attempt}/30`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}
