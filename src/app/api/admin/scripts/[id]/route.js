import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { revalidateSite } from '@/lib/cache';

export const dynamic = 'force-dynamic';

/**
 *   PUT    /api/admin/scripts/:id  { name?, code?, position?, enabled?, sort_order? } → { script }
 *   DELETE /api/admin/scripts/:id  → { success: true }
 */
const POSITIONS = ['head', 'body_start', 'body_end'];

export async function PUT(req, { params }) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const updates = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    updates.name = name;
  }
  if (body.code !== undefined) {
    const code = String(body.code).trim();
    if (!code) return NextResponse.json({ error: 'Code cannot be empty' }, { status: 400 });
    updates.code = code;
  }
  if (body.position !== undefined) {
    if (!POSITIONS.includes(body.position)) {
      return NextResponse.json({ error: 'Invalid position' }, { status: 400 });
    }
    updates.position = body.position;
  }
  if (typeof body.enabled === 'boolean') updates.enabled = body.enabled;
  if (body.sort_order !== undefined) {
    const sortOrder = Number.parseInt(body.sort_order, 10);
    updates.sort_order = Number.isFinite(sortOrder) ? sortOrder : 0;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error: dbError } = await db
    .from('site_scripts')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Script not found' }, { status: 404 });

  revalidateSite('site-scripts');
  return NextResponse.json({ script: data });
}

export async function DELETE(_req, { params }) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const { error: dbError } = await db.from('site_scripts').delete().eq('id', id);
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  revalidateSite('site-scripts');
  return NextResponse.json({ success: true });
}
