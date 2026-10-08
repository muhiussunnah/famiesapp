import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { requireAdmin } from '@/lib/admin';
import { SITE_URL } from '@/lib/site';
import {
  SITE_HOST,
  normalizePath,
  fetchAllPosts,
  getPublicUrls,
  getSitemapUrls,
  filterOwnUrls,
} from '@/lib/seo-urls';

/**
 * Indexing Report (admin only).
 *
 * GET  → cached Google index status per URL (table indexing_cache) joined
 *        with publish dates, the URLs never checked yet, and which
 *        integrations are configured.
 * POST { action }:
 *   get-urls        → URLs to check (sitemap.xml ∪ static pages + live posts)
 *   check-batch     → Search Console URL Inspection for ≤ 5 URLs, cached
 *   request-index   → Google Indexing API URL_UPDATED for one URL
 *   bulk-request    → same for ≤ 10 URLs
 *   indexnow-submit → IndexNow (Bing, Yandex, Seznam, IndexNow.org)
 *   submit-sitemap  → submit sitemap.xml to Search Console (+ IndexNow ping)
 *   prune           → list / delete cache rows for URLs that are no longer public
 *
 * Env vars:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY  (literal "\n" unescaped)
 *   GSC_SITE_URL   Search Console property — "sc-domain:famies.app" (default)
 *                  or a URL-prefix property like "https://famies.app/"
 *   INDEXNOW_KEY   8–128 chars [a-zA-Z0-9-]; served at /indexnow-key
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_GSC_PROPERTY = 'sc-domain:famies.app';
const INDEXNOW_KEY_PATH = '/indexnow-key';
const INDEXNOW_ENGINES = [
  { name: 'Bing', url: 'https://www.bing.com/indexnow' },
  { name: 'Yandex', url: 'https://yandex.com/indexnow' },
  { name: 'Seznam', url: 'https://search.seznam.cz/indexnow' },
  { name: 'IndexNow.org', url: 'https://api.indexnow.org/indexnow' },
];
const SCOPE_WEBMASTERS = 'https://www.googleapis.com/auth/webmasters';
const SCOPE_INDEXING = 'https://www.googleapis.com/auth/indexing';

/* ───────────────────────────── Config ───────────────────────────── */

function googlePrivateKey() {
  let key = (process.env.GOOGLE_PRIVATE_KEY || '').trim();
  // Vercel keeps surrounding quotes when the JSON value is pasted with them.
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1);
  return key.replace(/\\n/g, '\n');
}

function missingGoogleEnv() {
  const missing = [];
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) missing.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  if (!process.env.GOOGLE_PRIVATE_KEY) missing.push('GOOGLE_PRIVATE_KEY');
  return missing;
}

/** Search Console property: "sc-domain:famies.app" or "https://famies.app/". */
function gscProperty() {
  const raw = (process.env.GSC_SITE_URL || '').trim();
  if (!raw) return DEFAULT_GSC_PROPERTY;
  if (raw.startsWith('sc-domain:')) return raw;
  if (/^https?:\/\//i.test(raw)) return raw.endsWith('/') ? raw : `${raw}/`;
  return `sc-domain:${raw.replace(/^www\./i, '').replace(/\/+$/, '')}`;
}

function indexNowKey() {
  return (process.env.INDEXNOW_KEY || '').trim();
}

function configSummary() {
  const missing = missingGoogleEnv();
  const key = indexNowKey();
  return {
    siteUrl: SITE_URL,
    google: {
      configured: missing.length === 0,
      missing,
      property: gscProperty(),
      propertyFromEnv: !!(process.env.GSC_SITE_URL || '').trim(),
      serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null,
    },
    indexNow: {
      configured: !!key,
      valid: /^[a-zA-Z0-9-]{8,128}$/.test(key),
      missing: key ? [] : ['INDEXNOW_KEY'],
      keyLocation: `${SITE_URL}${INDEXNOW_KEY_PATH}`,
    },
  };
}

function notConfigured(what, missing) {
  return NextResponse.json(
    { error: `${what} is not configured`, missing, hint: `Set ${missing.join(', ')} in the Vercel environment variables and redeploy.` },
    { status: 503 }
  );
}

function googleAuth(scopes) {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: googlePrivateKey(),
    scopes,
  });
}

/** Readable message + status code from a googleapis error. */
function googleError(err) {
  const code = Number(err?.code || err?.response?.status || err?.status) || 0;
  const message =
    err?.response?.data?.error?.message ||
    err?.response?.data?.error_description ||
    err?.errors?.[0]?.message ||
    err?.message ||
    'Google API error';
  return { code, message: String(message).slice(0, 300) };
}

/** The private key / service account credentials themselves are unusable. */
const isCredentialError = (message) => /DECODER|PEM|private key|invalid_grant|asn1|invalid_client/i.test(message);

function googleHint(code, message, api) {
  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'the service account';
  if (isCredentialError(message)) {
    return 'GOOGLE_PRIVATE_KEY could not be used — paste the full "-----BEGIN PRIVATE KEY----- … -----END PRIVATE KEY-----" value from the JSON key file (\\n line breaks are fine).';
  }
  if (code === 429 || /quota/i.test(message)) {
    return api === 'indexing'
      ? 'Indexing API quota reached (default 200 URLs/day). Try again tomorrow.'
      : 'URL Inspection quota reached (2,000/day, 600/min per property). Try again later.';
  }
  if (code === 403 || code === 401) {
    if (api === 'indexing') {
      return `Enable the "Web Search Indexing API" in the Google Cloud project and add ${sa} as an Owner of the Search Console property ${gscProperty()}.`;
    }
    return `Add ${sa} as a user (Full or Owner) of the Search Console property ${gscProperty()}, and enable the "Google Search Console API" in the Google Cloud project. If the property is a URL-prefix property, set GSC_SITE_URL to it (e.g. https://famies.app/).`;
  }
  return null;
}

const isFatal = (code) => code === 401 || code === 403 || code === 429;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Only absolute URLs on the Famies domain. */
function ownUrls(list, max) {
  return filterOwnUrls(Array.isArray(list) ? list : []).slice(0, max);
}

/* ─────────────────────────────── GET ─────────────────────────────── */

export async function GET() {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const config = configSummary();
  const { data: cache, error: dbError } = await db.from('indexing_cache').select('*').order('url');
  if (dbError) {
    return NextResponse.json(
      { error: dbError.message, hint: 'Run supabase/famies-setup.sql — it creates the indexing_cache table.', config },
      { status: 500 }
    );
  }

  // Publish date per path so the UI can show "Published N days ago".
  const dateByPath = new Map();
  let publicUrls = [];
  try {
    const posts = await fetchAllPosts(db, 'slug, published_at, scheduled_at, created_at');
    for (const p of posts) {
      const d = p.published_at || p.scheduled_at || p.created_at;
      if (p.slug && d) dateByPath.set(normalizePath(p.slug), d);
    }
    publicUrls = await getPublicUrls(db);
  } catch {
    /* dates are a nice-to-have */
  }

  const results = (cache || []).map((r) => ({ ...r, published_at: dateByPath.get(normalizePath(r.url)) || null }));
  const indexed = results.filter((r) => r.status === 'indexed').length;
  const errors = results.filter((r) => r.status === 'error').length;
  const checkedPaths = new Set(results.filter((r) => r.checked_at).map((r) => normalizePath(r.url)));
  const pending = publicUrls.filter((u) => !checkedPaths.has(normalizePath(u.path))).map((u) => u.url);

  let lastScan = null;
  for (const r of results) if (r.checked_at && (!lastScan || r.checked_at > lastScan)) lastScan = r.checked_at;

  return NextResponse.json({
    total: results.length,
    indexed,
    notIndexed: results.length - indexed - errors,
    errors,
    indexRate: results.length ? Math.round((indexed / results.length) * 1000) / 10 : 0,
    results,
    pending,
    lastScan,
    config,
  });
}

/* ─────────────────────────────── POST ─────────────────────────────── */

async function submitIndexNow(urls, engines = INDEXNOW_ENGINES) {
  const key = indexNowKey();
  const payload = { host: SITE_HOST, key, keyLocation: `${SITE_URL}${INDEXNOW_KEY_PATH}`, urlList: urls };
  const describe = (status) =>
    ({
      200: 'Submitted',
      202: 'Accepted — key validation pending',
      400: 'Bad request',
      403: 'Key not valid — check /indexnow-key',
      422: 'URLs do not match the host or key',
      429: 'Too many requests',
    })[status] || `HTTP ${status}`;

  return Promise.all(
    engines.map(async (engine) => {
      try {
        const res = await fetch(engine.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });
        return { engine: engine.name, status: res.status, ok: res.ok, detail: describe(res.status) };
      } catch (err) {
        return { engine: engine.name, status: 0, ok: false, detail: err?.name === 'TimeoutError' ? 'Timed out' : 'Request failed' };
      }
    })
  );
}

export async function POST(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const nowIso = () => new Date().toISOString();

  /* ── URLs to check ── */
  if (action === 'get-urls') {
    try {
      const [sitemap, dbUrls] = await Promise.all([getSitemapUrls({ timeout: 15000 }), getPublicUrls(db).catch(() => [])]);
      const seen = new Set();
      const urls = [];
      for (const u of [...filterOwnUrls(sitemap.urls), ...dbUrls.map((d) => d.url)]) {
        const key = normalizePath(u);
        if (seen.has(key)) continue;
        seen.add(key);
        urls.push(u);
      }
      return NextResponse.json({ urls, count: urls.length, sitemapOk: sitemap.ok, sitemapCount: sitemap.urls.length });
    } catch (err) {
      return NextResponse.json({ error: 'Failed to collect URLs', details: err?.message }, { status: 500 });
    }
  }

  /* ── URL Inspection (Search Console) ── */
  if (action === 'check-batch') {
    const missing = missingGoogleEnv();
    if (missing.length) return notConfigured('Google Search Console', missing);
    const batch = ownUrls(body.urls, 5);
    if (!batch.length) return NextResponse.json({ error: 'No URLs provided' }, { status: 400 });

    const sc = google.searchconsole({ version: 'v1', auth: googleAuth([SCOPE_WEBMASTERS]) });
    const siteUrl = gscProperty();
    const results = [];

    for (let i = 0; i < batch.length; i++) {
      const url = batch[i];
      try {
        const inspection = await sc.urlInspection.index.inspect(
          { requestBody: { inspectionUrl: url, siteUrl, languageCode: 'en-US' } },
          { timeout: 20000 }
        );
        const idx = inspection.data.inspectionResult?.indexStatusResult;
        const coverageState = idx?.coverageState || 'Unknown';
        const cs = coverageState.toLowerCase();
        const isIndexed = idx?.verdict === 'PASS' || cs.includes('submitted and indexed') || (cs.includes('indexed') && !cs.includes('not indexed'));
        const record = {
          url,
          status: isIndexed ? 'indexed' : 'not_indexed',
          coverage_state: coverageState,
          last_crawl_time: idx?.lastCrawlTime || null,
          indexing_state: idx?.indexingState || null,
          page_fetch_state: idx?.pageFetchState || null,
          robots_txt_state: idx?.robotsTxtState || null,
          checked_at: nowIso(),
        };
        await db.from('indexing_cache').upsert(record, { onConflict: 'url' });
        results.push(record);
      } catch (err) {
        const { code, message } = googleError(err);
        // Permission / quota problems affect every URL — stop instead of
        // filling the cache with errors.
        if (isFatal(code) || isCredentialError(message)) {
          return NextResponse.json(
            { error: 'URL Inspection failed', details: message, hint: googleHint(code, message, 'inspection'), results, checked: results.length },
            { status: 502 }
          );
        }
        const record = { url, status: 'error', coverage_state: message.slice(0, 200) || 'API Error', checked_at: nowIso() };
        await db.from('indexing_cache').upsert(record, { onConflict: 'url' });
        results.push(record);
      }
      if (i < batch.length - 1) await sleep(1200); // ~1 req/sec
    }

    return NextResponse.json({ results, checked: results.length });
  }

  /* ── Indexing API (single) ── */
  if (action === 'request-index') {
    const missing = missingGoogleEnv();
    if (missing.length) return notConfigured('Google Indexing API', missing);
    const [url] = ownUrls([body.url], 1);
    if (!url) return NextResponse.json({ error: 'No valid URL' }, { status: 400 });

    try {
      const indexing = google.indexing({ version: 'v3', auth: googleAuth([SCOPE_INDEXING]) });
      await indexing.urlNotifications.publish({ requestBody: { url, type: 'URL_UPDATED' } }, { timeout: 20000 });
      await db.from('indexing_cache').upsert({ url, index_requested_at: nowIso() }, { onConflict: 'url' });
      return NextResponse.json({ success: true, url });
    } catch (err) {
      const { code, message } = googleError(err);
      return NextResponse.json(
        {
          error: 'Indexing request failed',
          details: message,
          hint: googleHint(code, message, 'indexing') || 'Ensure the service account has Indexing API access and is an Owner in Search Console.',
        },
        { status: 502 }
      );
    }
  }

  /* ── Indexing API (bulk, ≤ 10 per call) ── */
  if (action === 'bulk-request') {
    const missing = missingGoogleEnv();
    if (missing.length) return notConfigured('Google Indexing API', missing);
    const urls = ownUrls(body.urls, 10);
    if (!urls.length) return NextResponse.json({ error: 'No URLs' }, { status: 400 });

    const indexing = google.indexing({ version: 'v3', auth: googleAuth([SCOPE_INDEXING]) });
    let success = 0;
    let failed = 0;
    let lastError = null;
    let stopped = false;

    for (const url of urls) {
      try {
        await indexing.urlNotifications.publish({ requestBody: { url, type: 'URL_UPDATED' } }, { timeout: 20000 });
        await db.from('indexing_cache').upsert({ url, index_requested_at: nowIso() }, { onConflict: 'url' });
        success++;
      } catch (err) {
        const { code, message } = googleError(err);
        failed++;
        lastError = { details: message, hint: googleHint(code, message, 'indexing') };
        if (isFatal(code) || isCredentialError(message)) {
          failed += urls.length - success - failed;
          stopped = true;
          break;
        }
      }
      await sleep(500);
    }

    return NextResponse.json({ success, failed, total: success + failed, stopped, ...(lastError ? { lastError } : {}) });
  }

  /* ── IndexNow ── */
  if (action === 'indexnow-submit') {
    if (!indexNowKey()) return notConfigured('IndexNow', ['INDEXNOW_KEY']);
    const all = ownUrls(body.urls, 10000);
    // IndexNow only accepts URLs on the exact host sent in the payload.
    const batch = all.filter((u) => new URL(u).hostname.toLowerCase() === SITE_HOST).slice(0, 1000);
    const skipped = all.length - batch.length;
    if (!batch.length) return NextResponse.json({ error: 'No URLs on ' + SITE_HOST }, { status: 400 });

    const engines = await submitIndexNow(batch);
    if (engines.some((e) => e.ok)) {
      const now = nowIso();
      for (let i = 0; i < batch.length; i += 500) {
        await db
          .from('indexing_cache')
          .upsert(batch.slice(i, i + 500).map((url) => ({ url, indexnow_requested_at: now })), { onConflict: 'url' });
      }
    }
    return NextResponse.json({ success: engines.some((e) => e.ok), submitted: batch.length, skipped, engines });
  }

  /* ── Sitemap submit ── */
  if (action === 'submit-sitemap') {
    const sitemapUrl = `${SITE_URL}/sitemap.xml`;
    const submitted = [];

    const missing = missingGoogleEnv();
    if (missing.length) {
      submitted.push({ engine: 'Google Search Console', ok: false, detail: `Not configured — set ${missing.join(', ')}` });
    } else {
      try {
        const sc = google.searchconsole({ version: 'v1', auth: googleAuth([SCOPE_WEBMASTERS]) });
        await sc.sitemaps.submit({ siteUrl: gscProperty(), feedpath: sitemapUrl }, { timeout: 20000 });
        submitted.push({ engine: 'Google Search Console', ok: true, detail: 'Sitemap submitted' });
      } catch (err) {
        const { code, message } = googleError(err);
        submitted.push({ engine: 'Google Search Console', ok: false, detail: googleHint(code, message, 'inspection') || message.slice(0, 160) });
      }
    }

    // Bing retired its sitemap ping endpoint — notify it through IndexNow.
    if (!indexNowKey()) {
      submitted.push({ engine: 'Bing (IndexNow)', ok: false, detail: 'Not configured — set INDEXNOW_KEY' });
    } else {
      const [bing] = await submitIndexNow([sitemapUrl], INDEXNOW_ENGINES.filter((e) => e.name === 'Bing'));
      submitted.push({ engine: 'Bing (IndexNow)', ok: !!bing?.ok, detail: bing?.detail || 'Request failed' });
    }

    return NextResponse.json({ success: submitted.some((s) => s.ok), submitted, sitemapUrl, timestamp: nowIso() });
  }

  /* ── Remove cache rows for URLs that are no longer public ── */
  if (action === 'prune') {
    try {
      const [sitemap, dbUrls, cacheRes] = await Promise.all([
        getSitemapUrls(),
        getPublicUrls(db),
        db.from('indexing_cache').select('url'),
      ]);
      if (cacheRes.error) throw new Error(cacheRes.error.message);
      const current = new Set([...filterOwnUrls(sitemap.urls), ...dbUrls.map((u) => u.url)].map(normalizePath));
      const stale = (cacheRes.data || []).map((r) => r.url).filter((u) => !current.has(normalizePath(u)));

      if (body.dryRun !== false) return NextResponse.json({ stale, count: stale.length });

      for (let i = 0; i < stale.length; i += 100) {
        const { error: delError } = await db.from('indexing_cache').delete().in('url', stale.slice(i, i + 100));
        if (delError) throw new Error(delError.message);
      }
      return NextResponse.json({ removed: stale.length });
    } catch (err) {
      return NextResponse.json({ error: 'Cleanup failed', details: err?.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
