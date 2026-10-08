import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import {
  getGA4Report,
  getGA4ActiveUsers,
  getSearchConsoleData,
  missingGA4Env,
  missingGoogleCredentials,
  searchConsoleSiteUrl,
  googleErrorMessage,
} from '@/lib/google-analytics';

export const dynamic = 'force-dynamic';

/**
 * GA4 + Search Console numbers for the admin Dashboard.
 *
 * GET ?period=7d|30d|this_month|last_month|365d|lifetime
 *
 * Never fails because Google is missing or broken: each source reports
 * { configured, connected, error, missing } and the page renders a
 * "not configured" / error card for it.
 */
const PERIODS = ['7d', '30d', 'this_month', 'last_month', '365d', 'lifetime'];
const LIFETIME_START = '2020-01-01';
// Search Console keeps ~16 months of data.
const GSC_MAX_DAYS = 485;

const ymd = (d) => d.toISOString().slice(0, 10);

function utcToday() {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function addDays(d, days) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function resolvePeriod(period) {
  const today = utcToday();
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  switch (period) {
    case '7d':
      return { start: addDays(today, -6), end: today };
    case 'this_month':
      return { start: new Date(Date.UTC(y, m, 1)), end: today };
    case 'last_month':
      return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 0)) };
    case '365d':
      return { start: addDays(today, -364), end: today };
    case 'lifetime':
      return { start: new Date(`${LIFETIME_START}T00:00:00Z`), end: today, lifetime: true };
    case '30d':
    default:
      return { start: addDays(today, -29), end: today };
  }
}

/** One row per day across the range, merging GA4 users/pageviews with GSC clicks. */
function mergeDaily(range, gaDaily, gscDaily) {
  const map = new Map();
  for (const d of gaDaily) {
    map.set(d.date, { date: d.date, users: d.users, pageViews: d.pageViews, clicks: 0, impressions: 0 });
  }
  for (const d of gscDaily) {
    const row = map.get(d.date) || { date: d.date, users: 0, pageViews: 0, clicks: 0, impressions: 0 };
    row.clicks = d.clicks;
    row.impressions = d.impressions;
    map.set(d.date, row);
  }
  if (map.size === 0) return [];

  // "Lifetime" starts at the first day that has data, not in 2020.
  let start = range.start;
  if (range.lifetime) {
    const first = [...map.keys()].sort()[0];
    start = new Date(`${first}T00:00:00Z`);
  }

  const out = [];
  for (let d = new Date(start); d <= range.end; d = addDays(d, 1)) {
    const key = ymd(d);
    out.push(map.get(key) || { date: key, users: 0, pageViews: 0, clicks: 0, impressions: 0 });
  }
  return out;
}

function settledError(result) {
  return result.status === 'rejected' ? googleErrorMessage(result.reason) : null;
}

export async function GET(req) {
  const { error } = await requireAdmin();
  if (error) return error;

  const requested = req.nextUrl.searchParams.get('period') || '30d';
  const period = PERIODS.includes(requested) ? requested : '30d';
  const range = resolvePeriod(period);
  const startDate = ymd(range.start);
  const endDate = ymd(range.end);

  const gscEarliest = addDays(utcToday(), -GSC_MAX_DAYS);
  const gscStart = ymd(range.start < gscEarliest ? gscEarliest : range.start);

  const gaMissing = missingGA4Env();
  const gscMissing = missingGoogleCredentials();
  const gaOn = gaMissing.length === 0;
  const gscOn = gscMissing.length === 0;

  const [gaRes, users7dRes, todayRes, gscRes] = await Promise.allSettled([
    gaOn ? getGA4Report(startDate, endDate) : null,
    gaOn ? getGA4ActiveUsers('6daysAgo', 'today') : null,
    gaOn ? getGA4ActiveUsers('today', 'today') : null,
    gscOn ? getSearchConsoleData(gscStart, endDate) : null,
  ]);

  const ga = gaRes.status === 'fulfilled' ? gaRes.value : null;
  const gsc = gscRes.status === 'fulfilled' ? gscRes.value : null;
  const gaError = settledError(gaRes);
  const gscError = settledError(gscRes);
  if (gaError) console.error('[admin/analytics] GA4 error:', gaError);
  if (gscError) console.error('[admin/analytics] Search Console error:', gscError);

  const gscDaily = gsc?.daily ?? [];
  const searchTotals = gsc
    ? (() => {
        const clicks = gscDaily.reduce((s, d) => s + d.clicks, 0);
        const impressions = gscDaily.reduce((s, d) => s + d.impressions, 0);
        return {
          clicks,
          impressions,
          ctr: impressions ? Number(((clicks / impressions) * 100).toFixed(1)) : 0,
        };
      })()
    : null;

  return NextResponse.json({
    period,
    range: { start: startDate, end: endDate },

    ga: {
      configured: gaOn,
      connected: !!ga,
      missing: gaMissing,
      error: gaError,
    },
    gsc: {
      configured: gscOn,
      connected: !!gsc,
      missing: gscMissing,
      error: gscError,
      siteUrl: searchConsoleSiteUrl(),
    },

    overview: {
      users: ga?.overview.activeUsers ?? 0,
      newUsers: ga?.overview.newUsers ?? 0,
      sessions: ga?.overview.sessions ?? 0,
      pageViews: ga?.overview.pageViews ?? 0,
      users7d: users7dRes.status === 'fulfilled' ? users7dRes.value ?? 0 : 0,
      usersToday: todayRes.status === 'fulfilled' ? todayRes.value ?? 0 : 0,
    },

    daily: mergeDaily(range, ga?.daily ?? [], gscDaily),

    topPages: ga?.topPages ?? [],
    topCountries: ga?.topCountries ?? [],
    topSources: ga?.topSources ?? [],

    searchTotals,
    topKeywords: gsc?.topKeywords ?? [],
    topSearchPages: gsc?.topSearchPages ?? [],
  });
}
