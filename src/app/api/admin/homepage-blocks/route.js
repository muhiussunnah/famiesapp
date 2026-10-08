import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { revalidateSite } from '@/lib/cache';
import { BLOCK_TYPES } from '@/lib/homepage-blocks';
import { sanitizeArticleHtml } from '@/lib/sanitize';

/**
 * Admin CRUD for homepage_blocks (rendered by src/components/HomepageBlocks.js).
 *
 *   GET                                   → { blocks } every block, hidden ones included
 *   POST   { block_type, data, visible, after_id? }
 *                                         → { block } appended, or inserted right after `after_id`
 *   POST   ?seed=1                        → { blocks } inserts the Famies starter blocks
 *                                           (only while the table is empty; added hidden)
 *   PATCH  { id, data?, visible?, block_type? } → { block } update one block
 *   PATCH  { order: [id, id, …] }         → { ok } bulk reorder (order_index = array index)
 *   DELETE { id }  (or ?id=)              → { ok }
 *
 * Every write refreshes the 'homepage-blocks' cache tag + the site layout.
 */
export const dynamic = 'force-dynamic';

const VALID_TYPES = new Set(BLOCK_TYPES);

// Example blocks for "Load starter blocks". Same data shapes the admin
// editor writes, so they can be edited like any other block.
const STARTER_BLOCKS = [
  {
    block_type: 'heading',
    data: {
      eyebrow: 'Inspiration',
      title: 'Mer familjetid, mindre planering',
      subtitle:
        'Varje vecka samlar vi tips på utflykter, lek och event för familjer i hela Sverige. Här är några favoriter att börja med.',
      level: 'h2',
      align: 'center',
    },
  },
  {
    block_type: 'feature-grid',
    data: {
      title: '',
      columns: 3,
      items: [
        {
          title: 'Utflykter nära dig',
          description:
            '<p>Lekplatser, naturstigar och badplatser som andra familjer redan har testat, sorterade efter var ni är.</p>',
          image: '',
        },
        {
          title: 'Regnvädersräddare',
          description:
            '<p>Museer, lekland och pysselidéer för dagarna när det öser ner. Ingen behöver sitta inne och tråka ut sig.</p>',
          image: '',
        },
        {
          title: 'Event i helgen',
          description:
            '<p>Barnteater, marknader och familjedagar i din kommun, samlat på ett ställe. <a href="/inspiration">Hitta mer inspiration</a>.</p>',
          image: '',
        },
      ],
    },
  },
  {
    block_type: 'cta-box',
    data: {
      variant: 'accent',
      heading: 'Vad ska vi hitta på i helgen?',
      text: 'Öppna Famies och få förslag som passar era barns åldrar, nära där ni bor. Gratis, alltid.',
      buttonText: 'Ladda ner appen',
      buttonHref: '/#download',
    },
  },
];

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/** Strip scripts / event handlers from every HTML field a block can carry. */
function cleanData(data) {
  const d = isPlainObject(data) ? { ...data } : {};
  if (typeof d.html === 'string') d.html = sanitizeArticleHtml(d.html);
  if (Array.isArray(d.items)) {
    d.items = d.items.filter(isPlainObject).map((item) => ({
      ...item,
      description: typeof item.description === 'string' ? sanitizeArticleHtml(item.description) : '',
    }));
  }
  return d;
}

/** order_index = position in `ids`. */
async function applyOrder(db, ids) {
  const results = await Promise.all(
    ids.map((id, index) => db.from('homepage_blocks').update({ order_index: index }).eq('id', id))
  );
  return results.find((r) => r.error)?.error || null;
}

async function nextOrderIndex(db) {
  const { data } = await db
    .from('homepage_blocks')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.order_index ?? -1) + 1;
}

const fail = (message, status = 500) => NextResponse.json({ error: message }, { status });

export async function GET() {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const { data, error: dbError } = await db
    .from('homepage_blocks')
    .select('*')
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true });

  if (dbError) return fail(dbError.message);
  return NextResponse.json({ blocks: data ?? [] });
}

export async function POST(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  // ── Starter blocks ──
  if (req.nextUrl.searchParams.get('seed')) {
    const { count, error: countError } = await db
      .from('homepage_blocks')
      .select('id', { count: 'exact', head: true });
    if (countError) return fail(countError.message);
    if ((count ?? 0) > 0) {
      return fail('Starter blocks can only be loaded while the homepage has no blocks.', 409);
    }

    const rows = STARTER_BLOCKS.map((b, i) => ({
      block_type: b.block_type,
      data: b.data,
      visible: false, // drafts: nothing changes on the live site until the admin shows them
      order_index: i,
    }));
    const { data: inserted, error: insError } = await db.from('homepage_blocks').insert(rows).select();
    if (insError) return fail(insError.message);

    revalidateSite('homepage-blocks');
    return NextResponse.json({ blocks: inserted ?? [] });
  }

  // ── Single block ──
  const body = await req.json().catch(() => null);
  const blockType = body?.block_type;
  if (!blockType || !VALID_TYPES.has(blockType)) return fail('Invalid or missing block_type', 400);

  const { data: inserted, error: insError } = await db
    .from('homepage_blocks')
    .insert({
      block_type: blockType,
      data: cleanData(body.data),
      visible: body.visible !== false,
      order_index: await nextOrderIndex(db),
    })
    .select()
    .single();
  if (insError) return fail(insError.message);

  // Optionally slot the new block in right after another one.
  if (body.after_id) {
    const { data: all, error: listError } = await db
      .from('homepage_blocks')
      .select('id')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });
    if (!listError && all) {
      const ids = all.map((b) => b.id).filter((id) => id !== inserted.id);
      const at = ids.indexOf(body.after_id);
      if (at !== -1) {
        ids.splice(at + 1, 0, inserted.id);
        const orderError = await applyOrder(db, ids);
        if (orderError) return fail(orderError.message);
        inserted.order_index = at + 1;
      }
    }
  }

  revalidateSite('homepage-blocks');
  return NextResponse.json({ block: inserted });
}

export async function PATCH(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!isPlainObject(body)) return fail('Invalid JSON body', 400);

  // ── Bulk reorder ──
  if (Array.isArray(body.order)) {
    const ids = body.order.filter((id) => typeof id === 'string' && id);
    if (ids.length === 0) return fail('order must be a non-empty array of ids', 400);
    const orderError = await applyOrder(db, ids);
    if (orderError) return fail(orderError.message);
    revalidateSite('homepage-blocks');
    return NextResponse.json({ ok: true });
  }

  // ── Single update ──
  const { id } = body;
  if (!id) return fail('id required', 400);

  const updates = {};
  if ('block_type' in body) {
    if (!VALID_TYPES.has(body.block_type)) return fail('Invalid block_type', 400);
    updates.block_type = body.block_type;
  }
  if ('data' in body) updates.data = cleanData(body.data);
  if ('visible' in body) updates.visible = !!body.visible;
  if ('order_index' in body && Number.isFinite(Number(body.order_index))) {
    updates.order_index = Math.trunc(Number(body.order_index));
  }
  if (Object.keys(updates).length === 0) return fail('Nothing to update', 400);

  const { data, error: dbError } = await db
    .from('homepage_blocks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (dbError) return fail(dbError.message);

  revalidateSite('homepage-blocks');
  return NextResponse.json({ block: data });
}

export async function DELETE(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const id = body?.id || req.nextUrl.searchParams.get('id');
  if (!id) return fail('id required', 400);

  const { error: dbError } = await db.from('homepage_blocks').delete().eq('id', id);
  if (dbError) return fail(dbError.message);

  revalidateSite('homepage-blocks');
  return NextResponse.json({ ok: true });
}
