import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { revalidateSite } from '@/lib/cache';

export const dynamic = 'force-dynamic';

/**
 * Admin CRUD for /admin/header-scripts (table site_scripts).
 *
 *   GET  → { scripts: [...] } — every script, enabled or not, in load order
 *   POST { name, code, position?, enabled?, sort_order? } → { script }
 *
 * Update / delete live in ./[id]/route.js. Every write revalidates the
 * `site-scripts` tag + the root layout so the change is live immediately.
 */
const POSITIONS = ['head', 'body_start', 'body_end'];

export async function GET() {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const { data, error: dbError } = await db
    .from('site_scripts')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ scripts: data ?? [] });
}

export async function POST(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const position = body.position ?? 'head';
  const enabled = body.enabled !== false;
  const sortOrder = Number.parseInt(body.sort_order, 10);

  if (!name || !code) {
    return NextResponse.json({ error: 'Name and code are required' }, { status: 400 });
  }
  if (!POSITIONS.includes(position)) {
    return NextResponse.json({ error: 'Invalid position' }, { status: 400 });
  }

  const { data, error: dbError } = await db
    .from('site_scripts')
    .insert({ name, code, position, enabled, sort_order: Number.isFinite(sortOrder) ? sortOrder : 0 })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  revalidateSite('site-scripts');
  return NextResponse.json({ script: data });
}
