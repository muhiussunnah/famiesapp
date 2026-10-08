import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { revalidateSite } from '@/lib/cache';
import { normalizeDomain } from '@/lib/external-links';

export const dynamic = 'force-dynamic';

/**
 * Admin CRUD for /admin/external-links — the nofollow rule registry
 * (table external_links_nofollow).
 *
 *   GET    → { rules: [...] } — enabled + disabled, newest first
 *   POST   { pattern, match_type?, note?, enabled? } → { rule }
 *   PATCH  { id, pattern?, match_type?, note?, enabled? } → { rule }
 *   DELETE { id } → { ok: true }
 *
 * Every write revalidates the `nofollow-rules` tag + the root layout so
 * article pages pick up the change on the next request.
 */

// A pasted string with a scheme, slash or query string is an exact URL;
// anything else is a domain. The admin can override via match_type.
function inferMatchType(pattern) {
  const trimmed = pattern.trim();
  if (/^https?:\/\//i.test(trimmed)) return 'url';
  if (trimmed.includes('/') || trimmed.includes('?')) return 'url';
  return 'domain';
}

/** Clean a pattern for its type. Returns { value } or { error }. */
function cleanPattern(raw, matchType) {
  const pattern = String(raw ?? '').trim();
  if (!pattern) return { error: 'Pattern is required' };

  if (matchType === 'domain') {
    const domain = normalizeDomain(pattern);
    if (!domain || !domain.includes('.') || /\s/.test(domain)) {
      return { error: `"${pattern}" is not a valid domain (e.g. amazon.se).` };
    }
    return { value: domain };
  }

  // Exact URL: must be absolute so it can match an <a href>.
  try {
    const url = new URL(pattern);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('bad protocol');
  } catch {
    return { error: 'An exact-URL rule must be a full http(s):// address.' };
  }
  return { value: pattern };
}

function dbErrorResponse(dbError) {
  if (dbError.code === '23505' || /duplicate/i.test(dbError.message)) {
    return NextResponse.json({ error: 'A rule for this pattern already exists.' }, { status: 409 });
  }
  return NextResponse.json({ error: dbError.message }, { status: 500 });
}

export async function GET() {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const { data, error: dbError } = await db
    .from('external_links_nofollow')
    .select('*')
    .order('created_at', { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const rawPattern = String(body.pattern ?? '').trim();
  const matchType =
    body.match_type === 'domain' || body.match_type === 'url' ? body.match_type : inferMatchType(rawPattern);

  const cleaned = cleanPattern(rawPattern, matchType);
  if (cleaned.error) return NextResponse.json({ error: cleaned.error }, { status: 400 });

  const note = body.note ? String(body.note).trim() || null : null;
  const enabled = body.enabled !== false;

  const { data, error: dbError } = await db
    .from('external_links_nofollow')
    .insert({ pattern: cleaned.value, match_type: matchType, note, enabled })
    .select()
    .single();

  if (dbError) return dbErrorResponse(dbError);

  revalidateSite('nofollow-rules');
  return NextResponse.json({ rule: data });
}

export async function PATCH(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const id = body.id;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const update = {};
  if (body.match_type === 'domain' || body.match_type === 'url') update.match_type = body.match_type;

  if (typeof body.pattern === 'string') {
    let matchType = update.match_type;
    if (!matchType) {
      // Validate against the rule's stored type when only the pattern changes.
      const { data: existing, error: readError } = await db
        .from('external_links_nofollow')
        .select('match_type')
        .eq('id', id)
        .maybeSingle();
      if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
      if (!existing) return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
      matchType = existing.match_type;
    }
    const cleaned = cleanPattern(body.pattern, matchType);
    if (cleaned.error) return NextResponse.json({ error: cleaned.error }, { status: 400 });
    update.pattern = cleaned.value;
  }

  if (typeof body.note === 'string') update.note = body.note.trim() || null;
  if (typeof body.enabled === 'boolean') update.enabled = body.enabled;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error: dbError } = await db
    .from('external_links_nofollow')
    .update(update)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (dbError) return dbErrorResponse(dbError);
  if (!data) return NextResponse.json({ error: 'Rule not found' }, { status: 404 });

  revalidateSite('nofollow-rules');
  return NextResponse.json({ rule: data });
}

export async function DELETE(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const id = body.id;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error: dbError } = await db.from('external_links_nofollow').delete().eq('id', id);
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  revalidateSite('nofollow-rules');
  return NextResponse.json({ ok: true });
}
