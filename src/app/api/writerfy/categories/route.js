import { NextResponse } from 'next/server';
import { checkWriterfyAuth } from '@/lib/writerfy-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { CATEGORIES } from '@/lib/site';
import { slugify } from '@/lib/content-helpers';

/**
 * GET /api/writerfy/categories — the categories Writerfy can publish into,
 * with a published-post count each. Same Bearer token as /publish.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!checkWriterfyAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Counts are a nice-to-have: on a DB hiccup Writerfy still gets the list.
  const counts = {};
  const db = createAdminClient();
  if (db) {
    const { data } = await db.from('blog_posts').select('category').eq('status', 'published');
    for (const row of data ?? []) {
      if (row.category) counts[row.category] = (counts[row.category] || 0) + 1;
    }
  }

  return NextResponse.json({
    categories: CATEGORIES.map((name) => ({
      id: slugify(name),
      name,
      slug: slugify(name),
      count: counts[name] || 0,
    })),
  });
}
