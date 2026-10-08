import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { CACHE_TAGS } from '@/lib/cache';

/**
 * Admin-only "empty all caches" (like W3 Total Cache in WordPress).
 * Invalidates every data tag and the whole route cache; Next regenerates
 * each page lazily on its next request.
 */
export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  for (const tag of CACHE_TAGS) revalidateTag(tag, 'max');
  revalidatePath('/', 'layout');

  return NextResponse.json({ ok: true, clearedAt: new Date().toISOString() });
}
