import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { revalidateSite } from '@/lib/cache';

/**
 * Admin CRUD for footer_badges (partner / award images under the footer
 * link columns, read by src/lib/site-content.js).
 *
 *   GET                                  → { items } enabled + disabled
 *   POST  { location, image_url, link_url, alt_text?, width?, height?, enabled?, sort_order? } → { item }
 *   PATCH { order: [id, id, …] }         → { ok } bulk reorder (sort_order = index + 1)
 *
 * Single-item update / delete live in ./[id]/route.js.
 */
export const dynamic = 'force-dynamic';

const VALID_LOCATIONS = ['footer_explore', 'footer_company'];

const fail = (message, status = 500) => NextResponse.json({ error: message }, { status });

function cleanUrl(value) {
  const url = String(value ?? '').trim();
  if (!url || /^(javascript|vbscript|data):/i.test(url)) return null;
  return url;
}

/** Positive integer px, or null. */
function cleanSize(value) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 2000) : null;
}

export async function GET() {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const { data, error: dbError } = await db
    .from('footer_badges')
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
  const imageUrl = cleanUrl(body?.image_url);
  const linkUrl = cleanUrl(body?.link_url);

  if (!VALID_LOCATIONS.includes(location)) return fail('Invalid location', 400);
  if (!imageUrl || !linkUrl) return fail('Image URL and link URL are required', 400);

  let sortOrder = Number(body?.sort_order);
  if (!Number.isFinite(sortOrder)) {
    const { data: last } = await db
      .from('footer_badges')
      .select('sort_order')
      .eq('location', location)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (last?.sort_order ?? 0) + 1;
  }

  const { data, error: dbError } = await db
    .from('footer_badges')
    .insert({
      location,
      image_url: imageUrl,
      link_url: linkUrl,
      alt_text: String(body?.alt_text ?? '').trim() || null,
      width: cleanSize(body?.width) ?? 120,
      height: cleanSize(body?.height),
      sort_order: Math.trunc(sortOrder),
      enabled: body?.enabled !== false,
    })
    .select()
    .single();

  if (dbError) return fail(dbError.message);
  revalidateSite('site-content');
  return NextResponse.json({ item: data });
}

export async function PATCH(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.order) ? body.order.filter((id) => typeof id === 'string' && id) : [];
  if (ids.length === 0) return fail('order must be a non-empty array of ids', 400);

  const results = await Promise.all(
    ids.map((id, index) => db.from('footer_badges').update({ sort_order: index + 1 }).eq('id', id))
  );
  const dbError = results.find((r) => r.error)?.error;
  if (dbError) return fail(dbError.message);

  revalidateSite('site-content');
  return NextResponse.json({ ok: true });
}
