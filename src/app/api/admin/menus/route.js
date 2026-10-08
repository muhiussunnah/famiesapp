import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { revalidateSite } from '@/lib/cache';

/**
 * Admin CRUD for menu_items (read on the site by src/lib/menus.js).
 *
 *   GET                                   → { items } every location, disabled ones included
 *   POST  { location, label, url, target?, enabled?, sort_order? } → { item }
 *         (sort_order defaults to the end of that location)
 *   PATCH { order: [id, id, …] }          → { ok } bulk reorder (sort_order = index + 1)
 *
 * Single-item update / delete live in ./[id]/route.js.
 */
export const dynamic = 'force-dynamic';

const VALID_LOCATIONS = ['header', 'footer_explore', 'footer_company', 'footer_bottom'];
const VALID_TARGETS = ['_self', '_blank'];

const fail = (message, status = 500) => NextResponse.json({ error: message }, { status });

/** Trimmed URL, or null for empty / script URLs. */
function cleanUrl(value) {
  const url = String(value ?? '').trim();
  if (!url || /^(javascript|vbscript|data):/i.test(url)) return null;
  return url;
}

export async function GET() {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const { data, error: dbError } = await db
    .from('menu_items')
    .select('*')
    .order('location', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (dbError) return fail(dbError.message);
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const location = body?.location;
  const label = String(body?.label ?? '').trim();
  const url = cleanUrl(body?.url);
  const target = body?.target ?? '_self';

  if (!VALID_LOCATIONS.includes(location)) return fail('Invalid location', 400);
  if (!label || !url) return fail('Label and a valid URL are required', 400);
  if (!VALID_TARGETS.includes(target)) return fail('Invalid target', 400);

  let sortOrder = Number(body?.sort_order);
  if (!Number.isFinite(sortOrder)) {
    const { data: last } = await db
      .from('menu_items')
      .select('sort_order')
      .eq('location', location)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (last?.sort_order ?? 0) + 1;
  }

  const { data, error: dbError } = await db
    .from('menu_items')
    .insert({ location, label, url, target, sort_order: Math.trunc(sortOrder), enabled: body?.enabled !== false })
    .select()
    .single();

  if (dbError) return fail(dbError.message);
  revalidateSite('menus');
  return NextResponse.json({ item: data });
}

export async function PATCH(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.order) ? body.order.filter((id) => typeof id === 'string' && id) : [];
  if (ids.length === 0) return fail('order must be a non-empty array of ids', 400);

  const results = await Promise.all(
    ids.map((id, index) => db.from('menu_items').update({ sort_order: index + 1 }).eq('id', id))
  );
  const dbError = results.find((r) => r.error)?.error;
  if (dbError) return fail(dbError.message);

  revalidateSite('menus');
  return NextResponse.json({ ok: true });
}
