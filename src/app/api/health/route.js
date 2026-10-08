import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db/pool';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Container health check: 200 when the app runs and the database answers. */
export async function GET() {
  const pool = getPool();
  if (!pool) return NextResponse.json({ ok: true, database: 'not configured' });
  try {
    await pool.query('select 1');
    return NextResponse.json({ ok: true, database: 'up' });
  } catch (err) {
    return NextResponse.json({ ok: false, database: 'down', error: err.message }, { status: 503 });
  }
}
