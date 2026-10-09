import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';
// One keyword can need up to 10 SerpAPI calls (10 Google result pages).
// Keep requests short (60s); the admin page checks keywords
// one request at a time, so "check all" never needs longer.
export const maxDuration = 60;

/**
 * Rank tracker (table rank_keywords) — Google positions of famies.app via
 * SerpAPI, Google Sweden by default.
 *
 * GET                                   → { keywords, quota, configured, locale, domain }
 * POST { action: 'add', keyword }       → { keyword }
 * POST { action: 'check' }              → checks every keyword → { results, checked }
 *                                         (long lists can hit maxDuration; the UI uses check_single)
 * POST { action: 'check_single', id }   → { result }
 * POST { action: 'debug', keyword }     → raw top results for one query
 * POST { action: 'update_volume', id, volume }
 * DELETE { id }
 *
 * SerpAPI keys, in priority order: SERPAPI_KEY then SERPAPI_KEY_BACKUP.
 * Two free accounts (250 searches / 30 days each) pool into 500; when the
 * primary key is out of searches the backup is tried automatically.
 */
function serpKeys() {
  return [process.env.SERPAPI_KEY, process.env.SERPAPI_KEY_BACKUP].filter(Boolean);
}

const SITE_DOMAIN = new URL(SITE_URL).hostname.replace(/^www\./, '').toLowerCase();

// Google Sweden. SerpAPI's `location` must be a name from its locations API.
const SERP_LOCALE = {
  label: 'Google Sweden',
  flag: '🇸🇪',
  location: 'Sweden',
  google_domain: 'google.se',
  gl: 'se',
  hl: 'sv',
};

const SERP_BASE_PARAMS = {
  engine: 'google',
  location: SERP_LOCALE.location,
  google_domain: SERP_LOCALE.google_domain,
  gl: SERP_LOCALE.gl,
  hl: SERP_LOCALE.hl,
  num: '10',
};

const MAX_PAGES = 10; // 100 results; each page costs one SerpAPI search
const FETCH_TIMEOUT_MS = 30000;

// Free-tier SerpAPI plans reset on a rolling 30-day window anchored to the
// account's signup moment, not the 1st of the calendar month.
const ROLLING_CYCLE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Next quota-reset moment for one SerpAPI account:
 *   1. an explicit reset field from SerpAPI, if any;
 *   2. signup anchor (API field or SERPAPI_ACCOUNT_CREATED_AT[_BACKUP]
 *      env override) + N rolling 30-day cycles;
 *   3. fallback: 30 days from now.
 */
function computeResetAt(acc, anchorOverride) {
  const explicit = [
    acc?.next_billing_at,
    acc?.subscription_renewed_at,
    acc?.reset_at,
    acc?.plan_next_reset_at,
    acc?.next_reset_at,
  ];
  for (const c of explicit) {
    if (typeof c === 'string' && !isNaN(Date.parse(c))) return new Date(c).toISOString();
    if (typeof c === 'number' && c > 0) {
      // unix seconds vs milliseconds
      return new Date(c < 1e12 ? c * 1000 : c).toISOString();
    }
  }

  const creationCandidates = [acc?.account_created_at, acc?.created_at, acc?.plan_subscription_started_at, anchorOverride];
  for (const c of creationCandidates) {
    if (typeof c === 'string' && !isNaN(Date.parse(c))) {
      const created = new Date(c).getTime();
      const cyclesPassed = Math.floor(Math.max(0, Date.now() - created) / ROLLING_CYCLE_MS);
      return new Date(created + (cyclesPassed + 1) * ROLLING_CYCLE_MS).toISOString();
    }
  }

  return new Date(Date.now() + ROLLING_CYCLE_MS).toISOString();
}

/** Quota for one key, or null when SerpAPI did not return account info. */
async function fetchKeyQuota(key, anchorOverride) {
  try {
    const res = await fetch(`https://serpapi.com/account.json?api_key=${encodeURIComponent(key)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const acc = await res.json();
    if (acc?.total_searches_left === undefined && acc?.searches_per_month === undefined) return null;
    const limit = acc.searches_per_month || 250;
    const planLeft = acc.plan_searches_left ?? acc.total_searches_left ?? limit;
    const totalLeft = acc.total_searches_left ?? planLeft;
    return {
      used: Math.max(0, limit - planLeft),
      limit,
      remaining: totalLeft,
      resetAt: computeResetAt(acc, anchorOverride),
      planName: acc.plan_name || acc.plan_id || null,
    };
  } catch {
    return null;
  }
}

/** Pooled quota across all configured keys; reset = earliest refill. */
async function getCombinedQuota() {
  const keys = serpKeys();
  if (keys.length === 0) {
    return { used: 0, limit: 0, remaining: 0, resetAt: null, planName: null, keyCount: 0, keysConfigured: 0 };
  }

  const anchors = [process.env.SERPAPI_ACCOUNT_CREATED_AT, process.env.SERPAPI_ACCOUNT_CREATED_AT_BACKUP];
  const results = await Promise.all(keys.map((k, i) => fetchKeyQuota(k, anchors[i])));

  let used = 0;
  let limit = 0;
  let remaining = 0;
  let earliestReset = null;
  let planName = null;
  let keyCount = 0;
  for (const r of results) {
    if (!r) continue;
    keyCount += 1;
    used += r.used;
    limit += r.limit;
    remaining += r.remaining;
    const ts = new Date(r.resetAt).getTime();
    if (earliestReset === null || ts < earliestReset) earliestReset = ts;
    planName = planName || r.planName;
  }

  return {
    used,
    limit: limit || 250 * keys.length,
    remaining: keyCount ? remaining : 0,
    resetAt: earliestReset ? new Date(earliestReset).toISOString() : computeResetAt(null),
    planName,
    keyCount, // keys that answered the account API
    keysConfigured: keys.length,
  };
}

/** SerpAPI's various "out of searches" messages. */
function isQuotaError(msg) {
  if (!msg) return false;
  return /search(es)?\s+(ran|run)\s+out|exceeded|out of (search|credit)|monthly\s+limit|account\s+ran|over\s+the\s+limit|hourly\s+searches/i.test(msg);
}

/** Search with key failover: primary first, backup on a quota error. */
async function serpFetch(searchParams) {
  const keys = serpKeys();
  if (keys.length === 0) return { data: { error: 'No SERPAPI_KEY configured' }, keyIndex: -1 };

  let lastError = null;
  for (let i = 0; i < keys.length; i++) {
    const params = new URLSearchParams({ ...searchParams, api_key: keys[i] });
    try {
      const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const data = await res.json();
      if (data?.error && isQuotaError(data.error) && i < keys.length - 1) {
        lastError = data.error;
        continue;
      }
      return { data, keyIndex: i };
    } catch (e) {
      lastError = e?.message || String(e);
    }
  }
  return { data: { error: lastError || 'All SerpAPI keys exhausted' }, keyIndex: -1 };
}

/** Does this result URL belong to famies.app (apex or any subdomain)? */
function isOurUrl(link, displayed) {
  try {
    const host = new URL(link).hostname.toLowerCase();
    if (host === SITE_DOMAIN || host.endsWith(`.${SITE_DOMAIN}`)) return true;
  } catch {
    // not an absolute URL — fall through to the displayed link
  }
  const shown = (displayed || '').toLowerCase().replace(/^https?:\/\//, '');
  return shown === SITE_DOMAIN || shown.startsWith(`${SITE_DOMAIN}/`) || shown.startsWith(`${SITE_DOMAIN} `)
    || shown.startsWith(`www.${SITE_DOMAIN}`);
}

/**
 * Find famies.app in the first MAX_PAGES Google result pages for one
 * keyword. Stops at the first match or the first empty page.
 * Returns { position, rankUrl, totalOrganic } or { error }.
 */
async function findPosition(keyword) {
  let position = null;
  let rankUrl = '';
  let organic = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const start = page * 10;
    const { data } = await serpFetch({ ...SERP_BASE_PARAMS, q: keyword, start: String(start) });

    if (data.error) {
      // "Google hasn't returned any results" past the last page is not an error.
      if (page > 0 && /hasn't returned any results/i.test(data.error)) break;
      return { error: data.error };
    }

    // SerpAPI positions are relative to the page → absolute = start + pos.
    organic = data.organic_results || [];
    for (const result of organic) {
      if (isOurUrl(result.link || '', result.displayed_link)) {
        position = start + (result.position || organic.indexOf(result) + 1);
        rankUrl = result.link;
        break;
      }
    }

    if (page === 0 && !position) {
      const featured = data.answer_box || data.knowledge_graph;
      if (featured?.link && isOurUrl(featured.link)) {
        position = 1;
        rankUrl = featured.link;
      }
    }

    if (position || organic.length === 0) break;
  }

  return { position, rankUrl, totalOrganic: organic.length };
}

/** Run one keyword, store the result, return the row summary. */
async function checkKeyword(db, kw) {
  const found = await findPosition(kw.keyword);
  if (found.error) return { id: kw.id, keyword: kw.keyword, error: found.error };

  const prevPosition = kw.position;
  const change = prevPosition && found.position ? prevPosition - found.position : null; // + = improved
  const checkedAt = new Date().toISOString();

  const { error: dbError } = await db
    .from('rank_keywords')
    .update({
      prev_position: prevPosition,
      position: found.position,
      rank_url: found.rankUrl || null,
      change,
      checked_at: checkedAt,
    })
    .eq('id', kw.id);
  if (dbError) return { id: kw.id, keyword: kw.keyword, error: dbError.message };

  return {
    id: kw.id,
    keyword: kw.keyword,
    position: found.position,
    prev_position: prevPosition,
    change,
    rank_url: found.rankUrl || null,
    checked_at: checkedAt,
    total_organic: found.totalOrganic,
  };
}

const notConfigured = () =>
  NextResponse.json(
    { error: 'SerpAPI is not configured — set SERPAPI_KEY (and optionally SERPAPI_KEY_BACKUP) in Coolify → Environment Variables.' },
    { status: 503 }
  );

// ── GET: keywords + pooled quota ──
export async function GET() {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const [{ data: keywords, error: dbError }, quota] = await Promise.all([
    db.from('rank_keywords').select('*').order('created_at', { ascending: true }),
    getCombinedQuota(),
  ]);
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({
    keywords: keywords || [],
    quota,
    configured: serpKeys().length > 0,
    locale: SERP_LOCALE,
    domain: SITE_DOMAIN,
  });
}

// ── POST: add / check / check_single / debug / update_volume ──
export async function POST(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => ({}));

  if (body.action === 'add') {
    const keyword = String(body.keyword || '').trim().replace(/\s+/g, ' ').toLowerCase();
    if (keyword.length < 2) return NextResponse.json({ error: 'Keyword too short' }, { status: 400 });

    const { data: existing } = await db.from('rank_keywords').select('id').eq('keyword', keyword).maybeSingle();
    if (existing) return NextResponse.json({ error: 'Keyword already exists' }, { status: 409 });

    const { data, error: dbError } = await db.from('rank_keywords').insert({ keyword }).select().single();
    if (dbError) {
      const status = dbError.code === '23505' ? 409 : 500;
      return NextResponse.json({ error: status === 409 ? 'Keyword already exists' : dbError.message }, { status });
    }
    return NextResponse.json({ keyword: data });
  }

  if (body.action === 'check') {
    if (serpKeys().length === 0) return notConfigured();

    const { data: keywords, error: dbError } = await db
      .from('rank_keywords')
      .select('*')
      .order('created_at', { ascending: true });
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    if (!keywords?.length) return NextResponse.json({ error: 'No keywords to check' }, { status: 400 });

    const results = [];
    for (const kw of keywords) {
      try {
        const r = await checkKeyword(db, kw);
        results.push(r);
        // Every further keyword would fail the same way once all keys are out.
        if (r.error && isQuotaError(r.error)) break;
      } catch (err) {
        results.push({ id: kw.id, keyword: kw.keyword, error: err?.message || String(err) });
      }
    }
    return NextResponse.json({ results, checked: results.length });
  }

  if (body.action === 'check_single') {
    if (serpKeys().length === 0) return notConfigured();
    if (!body.id) return NextResponse.json({ error: 'Missing keyword id' }, { status: 400 });

    const { data: kw, error: kwErr } = await db.from('rank_keywords').select('*').eq('id', body.id).maybeSingle();
    if (kwErr || !kw) return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });

    try {
      const result = await checkKeyword(db, kw);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 502 });
      return NextResponse.json({ result });
    } catch (err) {
      return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
    }
  }

  if (body.action === 'debug') {
    const keyword = String(body.keyword || '').trim();
    if (!keyword) return NextResponse.json({ error: 'Missing keyword' }, { status: 400 });
    if (serpKeys().length === 0) return notConfigured();

    const { data, keyIndex } = await serpFetch({ ...SERP_BASE_PARAMS, q: keyword });
    const organic = (data.organic_results || []).map((r) => ({
      pos: r.position,
      title: r.title?.slice(0, 60),
      link: r.link,
      displayed: r.displayed_link,
    }));

    return NextResponse.json({
      error: data.error || null,
      search_info: data.search_information,
      locale: SERP_LOCALE,
      total_organic: organic.length,
      top_results: organic.slice(0, 15),
      our_match: organic.find((r) => isOurUrl(r.link || '', r.displayed)) || null,
      key_used: keyIndex, // 0 = primary, 1 = backup
      keys_configured: serpKeys().length,
    });
  }

  if (body.action === 'update_volume') {
    if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const volume = Number.parseInt(body.volume, 10);
    const { error: dbError } = await db
      .from('rank_keywords')
      .update({ volume: Number.isFinite(volume) && volume > 0 ? volume : null })
      .eq('id', body.id);
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// ── DELETE: remove keyword ──
export async function DELETE(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error: dbError } = await db.from('rank_keywords').delete().eq('id', id);
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
