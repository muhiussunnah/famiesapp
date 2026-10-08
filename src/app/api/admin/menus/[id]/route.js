import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { revalidateSite } from '@/lib/cache';

/**
 *   PUT / PATCH { location?, label?, url?, target?, sort_order?, enabled? } → { item }
 *   DELETE                                                                 → { ok }
 */
export const dynamic = 'force-dynamic';

const VALID_LOCATIONS = ['header', 'footer_explore', 'footer_company', 'footer_bottom'];
const VALID_TARGETS = ['_self', '_blank'];

const fail = (message, status = 500) => NextResponse.json({ error: message }, { status });

function cleanUrl(value) {
  const url = String(value ?? '').trim();
  if (!url || /^(javascript|vbscript|data):/i.test(url)) return null;
  return url;
}

export async function PUT(req, { params }) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail('Invalid JSON body', 400);

  const updates = {};
  if (body.location !== undefined) {
    if (!VALID_LOCATIONS.includes(body.location)) return fail('Invalid location', 400);
    updates.location = body.location;
  }
  if (body.label !== undefined) {
    const label = String(body.label).trim();
    if (!label) return fail('Label cannot be empty', 400);
    updates.label = label;
  }
  if (body.url !== undefined) {
    const url = cleanUrl(body.url);
    if (!url) return fail('Enter a valid URL', 400);
    updates.url = url;
  }
  if (body.target !== undefined) {
    if (!VALID_TARGETS.includes(body.target)) return fail('Invalid target', 400);
    updates.target = body.target;
  }
  if (body.sort_order !== undefined && Number.isFinite(Number(body.sort_order))) {
    updates.sort_order = Math.trunc(Number(body.sort_order));
  }
  if (body.enabled !== undefined) updates.enabled = !!body.enabled;
  if (Object.keys(updates).length === 0) return fail('Nothing to update', 400);

  const { data, error: dbError } = await db
    .from('menu_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (dbError) return fail(dbError.message);
  revalidateSite('menus');
  return NextResponse.json({ item: data });
}

export const PATCH = PUT;

export async function DELETE(_req, { params }) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const { error: dbError } = await db.from('menu_items').delete().eq('id', id);
  if (dbError) return fail(dbError.message);

  revalidateSite('menus');
  return NextResponse.json({ ok: true });
}
