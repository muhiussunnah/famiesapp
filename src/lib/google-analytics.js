/**
 * Google Analytics 4 (Data API) + Google Search Console reads for the
 * admin Dashboard, through a Google Cloud service account.
 *
 * Env vars:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  service account e-mail (…@….iam.gserviceaccount.com)
 *   GOOGLE_PRIVATE_KEY            its private key; literal "\n" sequences are unescaped
 *   GA4_PROPERTY_ID               numeric GA4 property id (or "properties/123…")
 *   GSC_SITE_URL                  optional Search Console property, e.g.
 *                                 "https://famies.app/". Default: "sc-domain:famies.app"
 *
 * The service account must be added as a Viewer on the GA4 property and as
 * a user on the Search Console property. Server-only.
 */
import { google } from 'googleapis';
import { SITE_URL } from '@/lib/site';

const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
];

function privateKey() {
  let key = process.env.GOOGLE_PRIVATE_KEY || '';
  // Env UIs sometimes keep the surrounding quotes of a pasted JSON value.
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n');
}

function propertyId() {
  const raw = (process.env.GA4_PROPERTY_ID || '').trim();
  return raw.replace(/^properties\//, '');
}

/** Env vars missing for the Google service account itself. */
export function missingGoogleCredentials() {
  const missing = [];
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) missing.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  if (!process.env.GOOGLE_PRIVATE_KEY) missing.push('GOOGLE_PRIVATE_KEY');
  return missing;
}

/** Env vars missing for GA4 reports (credentials + property id). */
export function missingGA4Env() {
  const missing = missingGoogleCredentials();
  if (!propertyId()) missing.push('GA4_PROPERTY_ID');
  return missing;
}

export function isGA4Configured() {
  return missingGA4Env().length === 0;
}

export function isSearchConsoleConfigured() {
  return missingGoogleCredentials().length === 0;
}

/** Search Console property the reports read from. */
export function searchConsoleSiteUrl() {
  // Same default as the Indexing Report (domain property).
  return (process.env.GSC_SITE_URL || '').trim() || `sc-domain:${new URL(SITE_URL).hostname}`;
}

let authClient = null;
function getAuth() {
  if (!authClient) {
    authClient = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: privateKey(),
      },
      scopes: SCOPES,
    });
  }
  return authClient;
}

function analyticsData() {
  return google.analyticsdata({ version: 'v1beta', auth: getAuth() });
}

function runReport(requestBody) {
  return analyticsData().properties.runReport({
    property: `properties/${propertyId()}`,
    requestBody,
  });
}

const num = (v) => Number(v || 0);

/** GA date "20260410" → "2026-04-10". */
function formatGADate(d) {
  if (!d || d.length !== 8) return d || '';
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

/**
 * Full GA4 report for a date range. Dates are "YYYY-MM-DD" or GA relative
 * dates ("7daysAgo", "today"). Throws on API errors (caller reports them).
 */
export async function getGA4Report(startDate, endDate) {
  const dateRanges = [{ startDate, endDate }];

  const [overviewRes, pagesRes, countriesRes, sourcesRes, dailyRes] = await Promise.all([
    runReport({
      dateRanges,
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'newUsers' },
      ],
    }),
    runReport({
      dateRanges,
      dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 25,
    }),
    runReport({
      dateRanges,
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 25,
    }),
    runReport({
      dateRanges,
      dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 25,
    }),
    runReport({
      dateRanges,
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    }),
  ]);

  const o = overviewRes.data.rows?.[0]?.metricValues ?? [];
  const overview = {
    activeUsers: num(o[0]?.value),
    sessions: num(o[1]?.value),
    pageViews: num(o[2]?.value),
    newUsers: num(o[3]?.value),
  };

  const topPages = (pagesRes.data.rows ?? []).map((row) => ({
    slug: row.dimensionValues?.[0]?.value || '/',
    title: row.dimensionValues?.[1]?.value || '(untitled)',
    views: num(row.metricValues?.[0]?.value),
  }));

  const topCountries = (countriesRes.data.rows ?? []).map((row) => ({
    country: row.dimensionValues?.[0]?.value || '(not set)',
    users: num(row.metricValues?.[0]?.value),
  }));

  const topSources = (sourcesRes.data.rows ?? []).map((row) => ({
    source: row.dimensionValues?.[0]?.value || '(direct)',
    medium: row.dimensionValues?.[1]?.value || '(none)',
    sessions: num(row.metricValues?.[0]?.value),
    users: num(row.metricValues?.[1]?.value),
  }));

  const daily = (dailyRes.data.rows ?? []).map((row) => ({
    date: formatGADate(row.dimensionValues?.[0]?.value),
    users: num(row.metricValues?.[0]?.value),
    pageViews: num(row.metricValues?.[1]?.value),
  }));

  return { overview, topPages, topCountries, topSources, daily };
}

/** Active users for one range (used for the fixed "7 days" / "today" tiles). */
export async function getGA4ActiveUsers(startDate, endDate) {
  const res = await runReport({
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: 'activeUsers' }],
  });
  return num(res.data.rows?.[0]?.metricValues?.[0]?.value);
}

/** Search Console queries, pages and daily clicks. Dates are "YYYY-MM-DD". Throws on API errors. */
export async function getSearchConsoleData(startDate, endDate) {
  const searchConsole = google.searchconsole({ version: 'v1', auth: getAuth() });
  const siteUrl = searchConsoleSiteUrl();
  const base = { startDate, endDate, type: 'web', dataState: 'all' };

  const [queriesRes, pagesRes, dailyRes] = await Promise.all([
    searchConsole.searchanalytics.query({ siteUrl, requestBody: { ...base, dimensions: ['query'], rowLimit: 25 } }),
    searchConsole.searchanalytics.query({ siteUrl, requestBody: { ...base, dimensions: ['page'], rowLimit: 25 } }),
    searchConsole.searchanalytics.query({ siteUrl, requestBody: { ...base, dimensions: ['date'], rowLimit: 1000 } }),
  ]);

  const host = new URL(SITE_URL).host.replace(/^www\./, '').replace(/\./g, '\\.');
  const originRe = new RegExp(`^https?://(www\\.)?${host}`, 'i');

  const shape = (row) => ({
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: Number(((row.ctr || 0) * 100).toFixed(1)),
    position: Number((row.position || 0).toFixed(1)),
  });

  const topKeywords = (queriesRes.data.rows ?? []).map((row) => ({
    keyword: row.keys?.[0] || '',
    ...shape(row),
  }));

  const topSearchPages = (pagesRes.data.rows ?? []).map((row) => ({
    page: (row.keys?.[0] || '').replace(originRe, '') || '/',
    url: row.keys?.[0] || '',
    ...shape(row),
  }));

  const daily = (dailyRes.data.rows ?? []).map((row) => ({
    date: row.keys?.[0] || '',
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
  }));

  return { siteUrl, topKeywords, topSearchPages, daily };
}

/** Short, human-readable reason from a googleapis error. */
export function googleErrorMessage(err) {
  const apiMsg = err?.response?.data?.error?.message || err?.errors?.[0]?.message;
  const msg = apiMsg || err?.message || String(err);
  return msg.length > 300 ? msg.slice(0, 300) + '…' : msg;
}
