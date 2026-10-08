import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { revalidateSite } from '@/lib/cache';

/**
 * Key/value site settings (table site_settings) used by Footer Content,
 * Homepage hero, Theme Colors, Custom CSS and the Coming Soon switch.
 *
 * GET              → { settings: [{ key, value, type, group_name, label, description, sort_order }] }
 *                    optional ?group=hero to filter
 * PUT { updates: [{ key, value }] } → upserts each key, returns { ok, updated }
 */
export async function GET(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const group = req.nextUrl.searchParams.get('group');
  let query = db.from('site_settings').select('*').order('group_name').order('sort_order');
  if (group) query = query.eq('group_name', group);

  const { data, error: dbError } = await query;
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ settings: data ?? [] });
}

export async function PUT(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const updates = Array.isArray(body?.updates) ? body.updates : [];
  // Only key + value: PostgREST fills columns missing from some rows with
  // NULL, so every row must carry the same keys. Labels/types come from
  // the seed in db/schema.sql; new keys get the column defaults.
  const rows = updates
    .filter((u) => u && typeof u.key === 'string' && u.key.trim())
    .map((u) => ({ key: u.key.trim(), value: u.value == null ? '' : String(u.value) }));

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  const { error: dbError } = await db.from('site_settings').upsert(rows, { onConflict: 'key' });
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  revalidateSite('site-content');
  return NextResponse.json({ ok: true, updated: rows.length });
}
