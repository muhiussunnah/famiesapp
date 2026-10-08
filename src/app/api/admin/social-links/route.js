import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { revalidateSite } from '@/lib/cache';
import { sanitizeArticleHtml } from '@/lib/sanitize';

/**
 * Admin CRUD for social_links (footer icons, read by src/lib/site-content.js).
 *
 *   GET                                         → { items } enabled + disabled
 *   POST  { label, href, icon_svg, bg_color?, icon_color?, enabled?, sort_order? } → { item }
 *   PATCH { order: [id, id, …] }                → { ok } bulk reorder (sort_order = index + 1)
 *
 * Single-item update / delete live in ./[id]/route.js.
 */
export const dynamic = 'force-dynamic';

const DEFAULT_BG = '#f3f4f6';
const DEFAULT_ICON = '#4b5563';

const fail = (message, status = 500) => NextResponse.json({ error: message }, { status });

function cleanUrl(value) {
  const url = String(value ?? '').trim();
  if (!url || /^(javascript|vbscript|data):/i.test(url)) return null;
  return url;
}

/** Sanitised <svg> markup, or null when there is no svg in it. */
function cleanSvg(value) {
  const svg = sanitizeArticleHtml(String(value ?? '').trim()).trim();
  return /^<svg[\s>]/i.test(svg) ? svg : null;
}

function cleanColor(value, fallback) {
  const color = String(value ?? '').trim().slice(0, 64);
  return color && !/[;{}<>]/.test(color) ? color : fallback;
}

export async function GET() {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const { data, error: dbError } = await db
    .from('social_links')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (dbError) return fail(dbError.message);
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const label = String(body?.label ?? '').trim();
  const href = cleanUrl(body?.href);
  const iconSvg = cleanSvg(body?.icon_svg);

  if (!label || !href) return fail('Label and a valid URL are required', 400);
  if (!iconSvg) return fail('Icon must be <svg> markup', 400);

  let sortOrder = Number(body?.sort_order);
  if (!Number.isFinite(sortOrder)) {
    const { data: last } = await db
      .from('social_links')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (last?.sort_order ?? 0) + 1;
  }

  const { data, error: dbError } = await db
    .from('social_links')
    .insert({
      label,
      href,
      icon_svg: iconSvg,
      bg_color: cleanColor(body?.bg_color, DEFAULT_BG),
      icon_color: cleanColor(body?.icon_color, DEFAULT_ICON),
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
    ids.map((id, index) => db.from('social_links').update({ sort_order: index + 1 }).eq('id', id))
  );
  const dbError = results.find((r) => r.error)?.error;
  if (dbError) return fail(dbError.message);

  revalidateSite('site-content');
  return NextResponse.json({ ok: true });
}
