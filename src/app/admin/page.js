import { getDb } from '@/lib/db';
import { isComingSoon } from '@/lib/site-content';
import DashboardClient from './DashboardClient';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

/**
 * /admin — Dashboard. The layout has already checked that the visitor is
 * an admin. The current site mode is read here (service role, no cache)
 * so the Coming Soon switch renders with the real value immediately;
 * everything else is fetched client-side from /api/admin/stats and
 * /api/admin/analytics.
 */
async function readSiteMode() {
  const db = getDb();
  if (!db) {
    return { comingSoon: null, saved: false, error: 'DATABASE_URL is not set on the server.' };
  }
  try {
    const { data, error } = await db
      .from('site_settings')
      .select('value')
      .eq('key', 'coming_soon')
      .maybeSingle();
    if (error) return { comingSoon: null, saved: false, error: error.message };
    const raw = data?.value ?? null;
    return {
      comingSoon: isComingSoon({ coming_soon: raw ?? undefined }),
      saved: raw === 'true' || raw === 'false',
      error: null,
    };
  } catch (err) {
    return { comingSoon: null, saved: false, error: err?.message || 'Could not read site settings.' };
  }
}

export default async function AdminDashboardPage() {
  const siteMode = await readSiteMode();
  return <DashboardClient siteMode={siteMode} />;
}
