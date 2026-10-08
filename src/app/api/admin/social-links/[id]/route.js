import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { revalidateSite } from '@/lib/cache';
import { sanitizeArticleHtml } from '@/lib/sanitize';

/**
 *   PUT / PATCH { label?, href?, icon_svg?, bg_color?, icon_color?, sort_order?, enabled? } → { item }
 *   DELETE                                                                                → { ok }
 */
export const dynamic = 'force-dynamic';

const fail = (message, status = 500) => NextResponse.json({ error: message }, { status });

function cleanUrl(value) {
  const url = String(value ?? '').trim();
  if (!url || /^(javascript|vbscript|data):/i.test(url)) return null;
  return url;
}

function cleanSvg(value) {
  const svg = sanitizeArticleHtml(String(value ?? '').trim()).trim();
  return /^<svg[\s>]/i.test(svg) ? svg : null;
}

function cleanColor(value) {
  const color = String(value ?? '').trim().slice(0, 64);
  return color && !/[;{}<>]/.test(color) ? color : null;
}

export async function PUT(req, { params }) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail('Invalid JSON body', 400);

  const updates = {};
  if (body.label !== undefined) {
    const label = String(body.label).trim();
    if (!label) return fail('Label cannot be empty', 400);
    updates.label = label;
  }
  if (body.href !== undefined) {
    const href = cleanUrl(body.href);
    if (!href) return fail('Enter a valid URL', 400);
    updates.href = href;
  }
  if (body.icon_svg !== undefined) {
    const svg = cleanSvg(body.icon_svg);
    if (!svg) return fail('Icon must be <svg> markup', 400);
    updates.icon_svg = svg;
  }
  if (body.bg_color !== undefined) {
    const color = cleanColor(body.bg_color);
    if (!color) return fail('Invalid background color', 400);
    updates.bg_color = color;
  }
  if (body.icon_color !== undefined) {
    const color = cleanColor(body.icon_color);
    if (!color) return fail('Invalid icon color', 400);
    updates.icon_color = color;
  }
  if (body.sort_order !== undefined && Number.isFinite(Number(body.sort_order))) {
    updates.sort_order = Math.trunc(Number(body.sort_order));
  }
  if (body.enabled !== undefined) updates.enabled = !!body.enabled;
  if (Object.keys(updates).length === 0) return fail('Nothing to update', 400);

  const { data, error: dbError } = await db
    .from('social_links')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (dbError) return fail(dbError.message);
  revalidateSite('site-content');
  return NextResponse.json({ item: data });
}

export const PATCH = PUT;

export async function DELETE(_req, { params }) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const { error: dbError } = await db.from('social_links').delete().eq('id', id);
  if (dbError) return fail(dbError.message);

  revalidateSite('site-content');
  return NextResponse.json({ ok: true });
}
