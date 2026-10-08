'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Globe, CheckCircle2, XCircle, AlertTriangle, Search, RefreshCw, ChevronLeft, ChevronRight, Send,
  ExternalLink, Clock, FileSearch, ArrowUpRight, Sparkles, Shield, Zap, Radio, KeyRound, ChevronDown,
  ChevronUp, Copy, Check, ArrowUpDown, Square, Trash2, Settings, Loader2,
} from 'lucide-react';
import { PageHeader, Card, Button, Input, Badge, Notice, StatCard, EmptyState, LoadingBlock } from '@/components/admin/ui';
import { useModal } from '@/components/admin/AdminModal';
import { cn } from '@/lib/utils';

const API = '/api/admin/indexing-report';
const PER_PAGE = 100;
const CHECK_BATCH = 5;
const BULK_BATCH = 10;
const INDEXNOW_BATCH = 1000;

/* ─────────────── Helpers ─────────────── */

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function extractPath(url) {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url;
  }
}

/** "Published N days ago" — null when the page has no publish date (static pages). */
function publishedAgo(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return 'Published today';
  if (days === 1) return 'Published 1 day ago';
  return `Published ${days} days ago`;
}

function errorText(data, fallback) {
  if (!data) return fallback;
  return [data.error || fallback, data.details, data.hint].filter(Boolean).join(' — ');
}

async function post(body) {
  const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && !data.error, status: res.status, data };
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ─────────────── UI pieces ─────────────── */

function DonutChart({ indexed, total }) {
  const pct = total > 0 ? (indexed / total) * 100 : 0;
  const r = 58;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="180" height="180" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#fecaca" strokeWidth="14" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="#10b981"
          strokeWidth="14"
          strokeDasharray={`${(pct / 100) * circ} ${circ}`}
          transform="rotate(-90 70 70)"
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-emerald-600">{pct.toFixed(1)}%</span>
        <span className="mt-0.5 text-xs font-semibold text-ink-500">Indexed</span>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }
  const base = 'w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors';
  return (
    <div className="flex items-center justify-center gap-1.5">
      <button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} className={cn(base, 'text-ink-500 hover:bg-ink-50 disabled:opacity-30')} aria-label="Previous page">
        <ChevronLeft className="w-4 h-4" />
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`dots-${i}`} className="w-8 text-center text-xs text-ink-300">…</span>
        ) : (
          <button key={p} type="button" onClick={() => onPage(p)} className={cn(base, p === page ? 'bg-primary text-white font-bold' : 'text-ink-500 hover:bg-ink-50')}>
            {p}
          </button>
        )
      )}
      <button type="button" onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className={cn(base, 'text-ink-500 hover:bg-ink-50 disabled:opacity-30')} aria-label="Next page">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function ProgressCard({ label, done, total, tone = 'pink', onStop }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <Card bodyClassName="p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-xs font-semibold text-ink-900">
          {label} {done} / {total}
        </span>
        <div className="flex items-center gap-3">
          <span className={cn('text-xs font-bold', tone === 'blue' ? 'text-sky-600' : 'text-primary-700')}>{pct}%</span>
          {onStop && (
            <Button variant="danger" size="sm" icon={Square} onClick={onStop}>
              Stop
            </Button>
          )}
        </div>
      </div>
      <div className="w-full h-2 rounded-full bg-ink-100 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', tone === 'blue' ? 'bg-sky-500' : 'bg-primary')} style={{ width: `${pct}%` }} />
      </div>
    </Card>
  );
}

function EngineResults({ rows, okLabel = 'Sent' }) {
  if (!rows) return null;
  return (
    <div className="mt-3 space-y-1.5">
      {rows.map((r) => (
        <div key={r.engine} className="flex items-center justify-between gap-2 rounded-lg bg-ink-50 px-3 py-1.5" title={r.detail || ''}>
          <span className="text-[11px] font-semibold text-ink-700">{r.engine}</span>
          <Badge tone={r.ok ? 'green' : 'red'}>{r.ok ? r.detail && r.status === 202 ? 'Accepted' : okLabel : r.status ? `Error ${r.status}` : 'Error'}</Badge>
        </div>
      ))}
      {rows.some((r) => !r.ok && r.detail) && (
        <p className="text-[11px] text-ink-500 leading-relaxed">{rows.filter((r) => !r.ok && r.detail).map((r) => `${r.engine}: ${r.detail}`).join(' · ')}</p>
      )}
    </div>
  );
}

function NotConfigured({ vars, children }) {
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800 leading-relaxed">
      <p className="font-bold">Not configured</p>
      <p>
        Set{' '}
        {vars.map((v, i) => (
          <span key={v}>
            <code className="rounded bg-white/70 px-1 font-mono text-[11px]">{v}</code>
            {i < vars.length - 1 ? ', ' : ''}
          </span>
        ))}{' '}
        in Vercel env.
      </p>
      {children}
    </div>
  );
}

/* ═══════════════════════════════ Page ═══════════════════════════════ */

export default function IndexingReportPage() {
  const { showConfirm } = useModal();

  const [results, setResults] = useState([]);
  const [pending, setPending] = useState([]);
  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState(null);

  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const stopRef = useRef(false);
  const [scanError, setScanError] = useState('');
  const [busy, setBusy] = useState(null); // url | 'indexnow-<url>' | '__bulk__' | '__prune__'

  const [search, setSearch] = useState('');
  const [indexedPage, setIndexedPage] = useState(1);
  const [notIndexedPage, setNotIndexedPage] = useState(1);
  const [notIndexedSort, setNotIndexedSort] = useState('none'); // none → oldest → newest
  const [copied, setCopied] = useState(false);
  const [copiedState, setCopiedState] = useState(null);

  const [toolsOpen, setToolsOpen] = useState(true);
  const [indexNowLoading, setIndexNowLoading] = useState(false);
  const [indexNowResults, setIndexNowResults] = useState(null);
  const [sitemapLoading, setSitemapLoading] = useState(false);
  const [sitemapResults, setSitemapResults] = useState(null);
  const [keyCheck, setKeyCheck] = useState(null); // null | 'checking' | 'ok' | 'missing'

  const googleReady = !!config?.google?.configured;
  const indexNowReady = !!config?.indexNow?.configured;

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(API, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (data.config) setConfig(data.config);
      if (!res.ok) {
        setLoadError(errorText(data, `Could not load the report (HTTP ${res.status})`));
      } else {
        setLoadError('');
        setResults(data.results || []);
        setPending(data.pending || []);
        setLastScan(data.lastScan || null);
      }
    } catch {
      setLoadError('Network error while loading the report.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  /** Merge freshly checked rows into the table without a full reload. */
  const mergeRows = (rows) => {
    if (!rows?.length) return;
    setResults((prev) => {
      const map = new Map(prev.map((r) => [r.url, r]));
      for (const r of rows) map.set(r.url, { ...map.get(r.url), ...r });
      return [...map.values()].sort((a, b) => a.url.localeCompare(b.url));
    });
  };

  /* ── URL Inspection scan ── */
  const runScan = async (onlyUrls) => {
    setScanning(true);
    setScanError('');
    setProgress({ done: 0, total: 0 });
    stopRef.current = false;
    try {
      let urls = onlyUrls;
      if (!urls) {
        const { ok, data } = await post({ action: 'get-urls' });
        if (!ok) throw new Error(errorText(data, 'Could not collect URLs'));
        urls = data.urls;
      }
      if (!urls?.length) throw new Error('No URLs found in the sitemap or database.');
      setProgress({ done: 0, total: urls.length });

      for (let i = 0; i < urls.length && !stopRef.current; i += CHECK_BATCH) {
        const batch = urls.slice(i, i + CHECK_BATCH);
        const { ok, data } = await post({ action: 'check-batch', urls: batch });
        mergeRows(data.results);
        if (!ok) {
          setScanError(errorText(data, 'URL Inspection failed'));
          break;
        }
        setProgress((p) => ({ ...p, done: Math.min(p.total, i + batch.length) }));
      }
      if (stopRef.current) toast('Scan stopped');
    } catch (err) {
      setScanError(err.message || 'Scan failed');
    }
    await fetchResults();
    setScanning(false);
  };

  /* ── Google Indexing API ── */
  const requestIndex = async (url) => {
    setBusy(url);
    const { ok, data } = await post({ action: 'request-index', url });
    if (ok) {
      toast.success(`Indexing requested: ${extractPath(url)}`);
      mergeRows([{ url, index_requested_at: new Date().toISOString() }]);
    } else {
      toast.error(errorText(data, 'Indexing request failed'), { duration: 8000 });
    }
    setBusy(null);
  };

  const bulkRequestNotIndexed = async () => {
    const urls = results.filter((r) => r.status !== 'indexed').map((r) => r.url);
    if (!urls.length) return;
    const confirmed = await showConfirm(
      `Request indexing for ${urls.length} URL${urls.length === 1 ? '' : 's'}?`,
      'Each URL uses one Google Indexing API request (default quota: 200 per day).',
      'warning',
      { confirmText: 'Request indexing' }
    );
    if (!confirmed) return;

    setBusy('__bulk__');
    setBulkProgress({ done: 0, total: urls.length });
    let success = 0;
    let failed = 0;
    let lastError = null;
    for (let i = 0; i < urls.length; i += BULK_BATCH) {
      const batch = urls.slice(i, i + BULK_BATCH);
      const { ok, data } = await post({ action: 'bulk-request', urls: batch });
      if (!ok) {
        failed += urls.length - i;
        lastError = errorText(data, 'Bulk request failed');
        break;
      }
      success += data.success || 0;
      failed += data.failed || 0;
      if (data.lastError) lastError = [data.lastError.details, data.lastError.hint].filter(Boolean).join(' — ');
      setBulkProgress({ done: Math.min(i + BULK_BATCH, urls.length), total: urls.length });
      if (data.stopped) {
        failed += Math.max(0, urls.length - i - BULK_BATCH);
        break;
      }
    }
    if (failed) toast.error(`Bulk: ${success} sent, ${failed} failed${lastError ? ` — ${lastError}` : ''}`, { duration: 9000 });
    else toast.success(`Bulk complete: ${success} URLs sent to Google`);
    setBulkProgress({ done: 0, total: 0 });
    await fetchResults();
    setBusy(null);
  };

  /* ── IndexNow ── */
  const submitIndexNowUrls = async (urls) => {
    const engines = new Map();
    let submitted = 0;
    for (let i = 0; i < urls.length; i += INDEXNOW_BATCH) {
      const { ok, data } = await post({ action: 'indexnow-submit', urls: urls.slice(i, i + INDEXNOW_BATCH) });
      if (!data.engines) throw new Error(errorText(data, 'IndexNow submission failed'));
      if (ok || data.success) submitted += data.submitted || 0;
      for (const e of data.engines) if (!engines.has(e.engine) || !e.ok) engines.set(e.engine, e);
    }
    return { submitted, engines: [...engines.values()] };
  };

  const submitIndexNow = async () => {
    const urls = results.filter((r) => r.status !== 'indexed').map((r) => r.url);
    if (!urls.length) {
      toast.success('All pages are already indexed!');
      return;
    }
    setIndexNowLoading(true);
    setIndexNowResults(null);
    try {
      const { submitted, engines } = await submitIndexNowUrls(urls);
      setIndexNowResults(engines);
      if (engines.some((e) => e.ok)) toast.success(`IndexNow: ${submitted} not-indexed URLs submitted`);
      else toast.error('IndexNow: every engine rejected the submission');
      await fetchResults();
    } catch (err) {
      toast.error(err.message || 'IndexNow submission failed');
    }
    setIndexNowLoading(false);
  };

  const submitSingleIndexNow = async (url) => {
    setBusy(`indexnow-${url}`);
    try {
      const { engines } = await submitIndexNowUrls([url]);
      if (engines.every((e) => e.ok)) toast.success(`IndexNow sent: ${extractPath(url)}`);
      else if (engines.some((e) => e.ok)) toast(`IndexNow partially accepted: ${engines.filter((e) => !e.ok).map((e) => e.engine).join(', ')} failed`);
      else toast.error('IndexNow: every engine rejected the URL');
      mergeRows([{ url, indexnow_requested_at: new Date().toISOString() }]);
    } catch (err) {
      toast.error(err.message || 'IndexNow failed');
    }
    setBusy(null);
  };

  const verifyKeyFile = async () => {
    setKeyCheck('checking');
    try {
      const res = await fetch('/indexnow-key', { cache: 'no-store' });
      const text = (await res.text()).trim();
      setKeyCheck(res.ok && text ? 'ok' : 'missing');
    } catch {
      setKeyCheck('missing');
    }
  };

  /* ── Sitemap submit ── */
  const submitSitemap = async () => {
    setSitemapLoading(true);
    setSitemapResults(null);
    const { data } = await post({ action: 'submit-sitemap' });
    const rows = data.submitted || [];
    setSitemapResults(rows);
    if (rows.length) toast[rows.some((r) => r.ok) ? 'success' : 'error'](`Sitemap submitted: ${rows.filter((r) => r.ok).length}/${rows.length} successful`);
    else toast.error(errorText(data, 'Sitemap submission failed'));
    setSitemapLoading(false);
  };

  /* ── Cache cleanup ── */
  const pruneStale = async () => {
    setBusy('__prune__');
    const preview = await post({ action: 'prune', dryRun: true });
    if (!preview.ok) {
      toast.error(errorText(preview.data, 'Could not check for stale URLs'));
      setBusy(null);
      return;
    }
    const stale = preview.data.stale || [];
    if (!stale.length) {
      toast.success('No stale URLs — every cached URL is still public');
      setBusy(null);
      return;
    }
    const sample = stale.slice(0, 5).map(extractPath).join('\n');
    const confirmed = await showConfirm(
      `Remove ${stale.length} stale URL${stale.length === 1 ? '' : 's'} from the report?`,
      `These URLs are no longer in the sitemap or live posts (deleted or unpublished):\n${sample}${stale.length > 5 ? '\n…' : ''}\n\nOnly the cached report rows are removed — nothing on the site changes.`,
      'danger',
      { confirmText: 'Remove' }
    );
    if (confirmed) {
      const { ok, data } = await post({ action: 'prune', dryRun: false });
      if (ok) toast.success(`Removed ${data.removed} stale URL${data.removed === 1 ? '' : 's'}`);
      else toast.error(errorText(data, 'Cleanup failed'));
      await fetchResults();
    }
    setBusy(null);
  };

  /* ── Copy helpers ── */
  const copyNotIndexedUrls = async () => {
    const urls = results.filter((r) => r.status !== 'indexed').map((r) => r.url);
    if (await copyText(urls.join('\n'))) {
      setCopied(true);
      toast.success(`${urls.length} URLs copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } else toast.error('Clipboard is not available');
  };

  const copyByCoverageState = async (state) => {
    const urls = results.filter((r) => (r.coverage_state || 'Unknown') === state).map((r) => r.url);
    if (!urls.length) return toast('No URLs in this group');
    if (await copyText(urls.join('\n'))) {
      setCopiedState(state);
      toast.success(`${urls.length} "${state}" URL${urls.length === 1 ? '' : 's'} copied`);
      setTimeout(() => setCopiedState((s) => (s === state ? null : s)), 2000);
    } else toast.error('Clipboard is not available');
  };

  /* ── Derived lists ── */
  const q = search.trim().toLowerCase();
  const matches = (r) => !q || extractPath(r.url).toLowerCase().includes(q);
  const indexed = results.filter((r) => r.status === 'indexed' && matches(r));
  const notIndexed = results.filter((r) => r.status !== 'indexed' && matches(r));
  const indexedTotal = results.filter((r) => r.status === 'indexed').length;
  const notIndexedTotal = results.length - indexedTotal;

  let notIndexedSorted = notIndexed;
  if (notIndexedSort !== 'none') {
    const withDate = notIndexed.filter((r) => r.published_at);
    const noDate = notIndexed.filter((r) => !r.published_at);
    withDate.sort((a, b) => {
      const d = new Date(a.published_at).getTime() - new Date(b.published_at).getTime();
      return notIndexedSort === 'oldest' ? d : -d;
    });
    notIndexedSorted = [...withDate, ...noDate];
  }

  const indexedPages = Math.ceil(indexed.length / PER_PAGE) || 1;
  const notIndexedPages = Math.ceil(notIndexedSorted.length / PER_PAGE) || 1;
  const indexedSlice = indexed.slice((indexedPage - 1) * PER_PAGE, indexedPage * PER_PAGE);
  const notIndexedSlice = notIndexedSorted.slice((notIndexedPage - 1) * PER_PAGE, notIndexedPage * PER_PAGE);
  const totalUrls = results.length;
  const indexRate = totalUrls > 0 ? Math.round((indexedTotal / totalUrls) * 1000) / 10 : 0;

  const coverageGroups = Object.entries(
    results.reduce((acc, r) => {
      const key = r.coverage_state || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  if (loading) return <LoadingBlock label="Loading indexing report…" />;

  const googleMissing = config?.google?.missing || ['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY'];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Globe}
        title="Indexing Report"
        description="Which famies.app pages Google has indexed (Search Console URL Inspection), plus one-click Google Indexing API, IndexNow and sitemap submissions."
        className="mb-0"
        actions={
          <>
            {lastScan && (
              <span className="flex items-center gap-1.5 text-xs text-ink-500">
                <Clock className="w-3.5 h-3.5" /> Last scan: {timeAgo(lastScan)}
              </span>
            )}
            {scanning ? (
              <Button variant="danger" icon={Square} onClick={() => (stopRef.current = true)}>
                Stop scan
              </Button>
            ) : (
              <Button variant="accent" icon={RefreshCw} onClick={() => runScan()} disabled={!googleReady || !!busy} title={googleReady ? '' : 'Google Search Console is not configured'}>
                Run scan
              </Button>
            )}
          </>
        }
      />

      {loadError && (
        <Notice tone="error" title="Could not load the report">
          {loadError}
        </Notice>
      )}

      {/* ── Google not configured ── */}
      {config && !googleReady && (
        <Card
          title="Google Search Console — not configured"
          description="Index checks, “Request indexing” and sitemap submission need a Google Cloud service account."
          actions={<Settings className="w-5 h-5 text-ink-300" />}
        >
          <NotConfigured vars={googleMissing} />
          <ol className="mt-4 space-y-1.5 text-[13px] text-ink-700 list-decimal pl-5 leading-relaxed">
            <li>Google Cloud Console → create a project and a <strong>service account</strong>, then add a JSON key.</li>
            <li>Enable the <strong>Google Search Console API</strong> and the <strong>Web Search Indexing API</strong>.</li>
            <li>
              Search Console → Settings → Users and permissions → add the service account e-mail as an <strong>Owner</strong> of the{' '}
              <code className="rounded bg-ink-50 px-1 font-mono text-[12px]">{config.google.property}</code> property.
            </li>
            <li>
              Vercel → Settings → Environment Variables: <code className="font-mono text-[12px]">GOOGLE_SERVICE_ACCOUNT_EMAIL</code> = <code className="font-mono text-[12px]">client_email</code>,{' '}
              <code className="font-mono text-[12px]">GOOGLE_PRIVATE_KEY</code> = <code className="font-mono text-[12px]">private_key</code> from the JSON file. Optional:{' '}
              <code className="font-mono text-[12px]">GSC_SITE_URL</code> (default <code className="font-mono text-[12px]">sc-domain:famies.app</code>; use{' '}
              <code className="font-mono text-[12px]">https://famies.app/</code> for a URL-prefix property). Redeploy.
            </li>
          </ol>
        </Card>
      )}
      {config && googleReady && (
        <p className="-mt-3 text-[12px] text-ink-500">
          Search Console property <code className="rounded bg-white border border-ink-100 px-1.5 py-0.5 font-mono text-[11px] text-ink-700">{config.google.property}</code>
          {config.google.serviceAccount && (
            <>
              {' '}· service account <code className="rounded bg-white border border-ink-100 px-1.5 py-0.5 font-mono text-[11px] text-ink-700">{config.google.serviceAccount}</code>
            </>
          )}
        </p>
      )}

      {/* ── Progress ── */}
      {scanning && progress.total > 0 && <ProgressCard label="Checking URLs…" done={progress.done} total={progress.total} />}
      {busy === '__bulk__' && bulkProgress.total > 0 && <ProgressCard label="Requesting indexing…" done={bulkProgress.done} total={bulkProgress.total} tone="blue" />}

      {scanError && (
        <Notice tone="error" title="Scan error">
          {scanError}
        </Notice>
      )}

      {/* ── New URLs never checked ── */}
      {googleReady && !scanning && pending.length > 0 && results.length > 0 && (
        <Notice tone="info" title={`${pending.length} public URL${pending.length === 1 ? ' has' : 's have'} never been checked`}>
          <p>New posts or pages since the last full scan.</p>
          <Button size="sm" variant="secondary" icon={FileSearch} className="mt-2" onClick={() => runScan(pending)} disabled={!!busy}>
            Check new URLs ({pending.length})
          </Button>
        </Notice>
      )}

      {/* ── SEO boost tools ── */}
      <Card bodyClassName="p-0">
        <button
          type="button"
          onClick={() => setToolsOpen(!toolsOpen)}
          className={cn('w-full flex items-center justify-between px-5 py-4 text-left rounded-t-2xl bg-violet-50/60', toolsOpen ? 'border-b border-ink-100' : 'rounded-b-2xl')}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink-900">SEO boost tools</h2>
              <p className="text-[11px] text-ink-500">IndexNow, sitemap submit, IndexNow key file</p>
            </div>
          </div>
          {toolsOpen ? <ChevronUp className="w-4 h-4 text-ink-300" /> : <ChevronDown className="w-4 h-4 text-ink-300" />}
        </button>

        {toolsOpen && (
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-ink-100">
            {/* IndexNow */}
            <div className="p-5 flex flex-col">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Zap className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-ink-900">IndexNow</h3>
                  <p className="text-[11px] text-ink-500">Instant crawl notification</p>
                </div>
              </div>
              <p className="text-[12px] text-ink-500 leading-relaxed mb-4">Submit the not-indexed URLs to Bing, Yandex, Seznam and every IndexNow engine. No daily limit.</p>
              {indexNowReady ? (
                <>
                  {!config.indexNow.valid && (
                    <Notice tone="warning" className="mb-3">INDEXNOW_KEY should be 8–128 characters of a–z, A–Z, 0–9 or “-”.</Notice>
                  )}
                  <Button className="mt-auto w-full" icon={Zap} loading={indexNowLoading} onClick={submitIndexNow} disabled={!results.length}>
                    {indexNowLoading ? 'Submitting…' : `Submit not-indexed (${notIndexedTotal})`}
                  </Button>
                  <EngineResults rows={indexNowResults} />
                </>
              ) : (
                <div className="mt-auto">
                  <NotConfigured vars={['INDEXNOW_KEY']}>
                    <p className="mt-1">Any random 32-character string works (e.g. a UUID without dashes).</p>
                  </NotConfigured>
                </div>
              )}
            </div>

            {/* Sitemap submit */}
            <div className="p-5 flex flex-col">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Radio className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-ink-900">Sitemap submit</h3>
                  <p className="text-[11px] text-ink-500">Google Search Console + Bing</p>
                </div>
              </div>
              <p className="text-[12px] text-ink-500 leading-relaxed mb-4">
                Submit{' '}
                <a href={`${config?.siteUrl || ''}/sitemap.xml`} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-700 hover:underline">
                  /sitemap.xml
                </a>{' '}
                to Google Search Console and Bing. Use after publishing new content.
              </p>
              {!googleReady && !indexNowReady ? (
                <div className="mt-auto">
                  <NotConfigured vars={[...googleMissing, 'INDEXNOW_KEY']} />
                </div>
              ) : (
                <>
                  <Button className="mt-auto w-full" variant="secondary" icon={Radio} loading={sitemapLoading} onClick={submitSitemap}>
                    {sitemapLoading ? 'Submitting…' : 'Submit sitemap'}
                  </Button>
                  <EngineResults rows={sitemapResults} okLabel="Submitted" />
                </>
              )}
            </div>

            {/* IndexNow key file */}
            <div className="p-5 flex flex-col">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <KeyRound className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-ink-900">IndexNow key file</h3>
                  <p className="text-[11px] text-ink-500">Lets engines verify submissions</p>
                </div>
              </div>
              <p className="text-[12px] text-ink-500 leading-relaxed mb-3">Served from the INDEXNOW_KEY env var — no static key file needed:</p>
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 font-mono text-[11px] text-ink-700 break-all">
                <KeyRound className="w-3 h-3 shrink-0 text-amber-600" />
                {config?.indexNow?.keyLocation || '/indexnow-key'}
              </div>
              <div className="mt-auto flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1" icon={Shield} loading={keyCheck === 'checking'} onClick={verifyKeyFile}>
                  Verify
                </Button>
                {indexNowReady && (
                  <a
                    href="/indexnow-key"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink-100 bg-white px-3 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open
                  </a>
                )}
              </div>
              {keyCheck === 'ok' && (
                <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Key file is live on this deployment
                </p>
              )}
              {keyCheck === 'missing' && (
                <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-red-500">
                  <XCircle className="w-3.5 h-3.5" /> Key file returns 404 — set INDEXNOW_KEY and redeploy
                </p>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ── Empty state ── */}
      {results.length === 0 && !scanning && !loadError && (
        <Card>
          <EmptyState
            icon={FileSearch}
            title="No scan data yet"
            text={
              googleReady
                ? 'Run your first scan to check which pages from the sitemap are indexed by Google.'
                : 'Configure Google Search Console (see above) to start checking which pages are indexed.'
            }
            action={
              googleReady && (
                <Button variant="accent" icon={Sparkles} onClick={() => runScan()}>
                  Run your first scan
                </Button>
              )
            }
          />
        </Card>
      )}

      {results.length > 0 && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard icon={FileSearch} label="Total pages" value={totalUrls} tone="blue" />
            <StatCard icon={CheckCircle2} label="Indexed" value={indexedTotal} tone="green" />
            <StatCard icon={XCircle} label="Not indexed" value={notIndexedTotal} tone="pink" />
            <StatCard icon={Shield} label="Index rate" value={`${indexRate}%`} tone="amber" />
          </div>

          {/* Chart + coverage breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card bodyClassName="p-6 flex flex-col items-center justify-center h-full">
              <DonutChart indexed={indexedTotal} total={totalUrls} />
              <div className="mt-4 flex items-center gap-6">
                <span className="flex items-center gap-2 text-xs text-ink-500">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" /> Indexed ({indexedTotal})
                </span>
                <span className="flex items-center gap-2 text-xs text-ink-500">
                  <span className="w-3 h-3 rounded-full bg-red-200" /> Not indexed ({notIndexedTotal})
                </span>
              </div>
            </Card>

            <Card title="Coverage breakdown">
              <div className="space-y-2">
                {coverageGroups.map(([state, count]) => {
                  const pct = totalUrls > 0 ? (count / totalUrls) * 100 : 0;
                  const lower = state.toLowerCase();
                  const green = lower.includes('indexed') && !lower.includes('not');
                  const justCopied = copiedState === state;
                  return (
                    <button
                      key={state}
                      type="button"
                      onClick={() => copyByCoverageState(state)}
                      title={`Click to copy all ${count} "${state}" URL${count === 1 ? '' : 's'}`}
                      className={cn('group w-full text-left rounded-lg px-2 -mx-2 py-1.5 transition-colors', justCopied ? 'bg-emerald-50' : 'hover:bg-ink-50')}
                    >
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className="flex items-center gap-1.5 text-xs text-ink-900 truncate">
                          {justCopied ? (
                            <Check className="w-3 h-3 shrink-0 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3 shrink-0 text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                          <span className="truncate">{state}</span>
                        </span>
                        <span className={cn('shrink-0 text-xs font-bold', justCopied || green ? 'text-emerald-600' : 'text-amber-600')}>
                          {justCopied ? 'Copied!' : `${count} (${pct.toFixed(0)}%)`}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-ink-100">
                        <div
                          className={cn('h-full rounded-full transition-all duration-700', green ? 'bg-emerald-500' : lower.includes('error') ? 'bg-red-500' : 'bg-amber-400')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
                <p className="flex items-center gap-1 pt-1 text-[11px] text-ink-300">
                  <Copy className="w-3 h-3" /> Click any row to copy its URLs
                </p>
              </div>
              {lastScan && (
                <div className="mt-4 pt-3 flex items-center justify-between border-t border-ink-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-300">Last scan</span>
                  <span className="text-xs font-semibold text-ink-700">{timeAgo(lastScan)}</span>
                </div>
              )}
            </Card>
          </div>

          {/* Search + bulk actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300 pointer-events-none" />
              <Input
                className="pl-9"
                placeholder="Search pages…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setIndexedPage(1);
                  setNotIndexedPage(1);
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" icon={Trash2} loading={busy === '__prune__'} onClick={pruneStale} disabled={!!busy || scanning}>
                Clean up stale URLs
              </Button>
              {notIndexedTotal > 0 && googleReady && (
                <Button variant="danger" size="sm" icon={Send} loading={busy === '__bulk__'} onClick={bulkRequestNotIndexed} disabled={!!busy || scanning}>
                  Index all not-indexed ({notIndexedTotal})
                </Button>
              )}
            </div>
          </div>

          {/* Two-column URL lists */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Indexed */}
            <Card bodyClassName="p-0">
              <div className="flex items-center gap-2 px-5 py-3.5 rounded-t-2xl bg-emerald-50 border-b border-ink-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-bold text-emerald-700">Indexed pages</span>
                <Badge tone="green">{indexed.length}</Badge>
              </div>
              <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
                {indexedSlice.length === 0 ? (
                  <p className="p-8 text-center text-xs text-ink-500">No indexed pages found</p>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-ink-100">
                        <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-500">#</th>
                        <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-500">URL</th>
                        <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-500 text-center">Crawled</th>
                        <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-500 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {indexedSlice.map((row, i) => (
                        <tr key={row.url} className="hover:bg-ink-50/60">
                          <td className="px-4 py-2.5 font-mono text-xs text-ink-300">{(indexedPage - 1) * PER_PAGE + i + 1}</td>
                          <td className="px-4 py-2.5">
                            <a href={row.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-[260px] items-center gap-1 truncate text-xs font-semibold text-ink-900 hover:underline">
                              <span className="truncate">{extractPath(row.url)}</span>
                              <ExternalLink className="w-3 h-3 shrink-0 opacity-40" />
                            </a>
                            {row.index_requested_at && (
                              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-600">
                                <Send className="w-2.5 h-2.5" /> Google {timeAgo(row.index_requested_at)}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center text-[11px] text-ink-500">{timeAgo(row.last_crawl_time)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => requestIndex(row.url)}
                              disabled={!googleReady || busy === row.url}
                              title={googleReady ? 'Ask Google to recrawl this URL' : 'Google is not configured'}
                              className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                            >
                              {busy === row.url ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpRight className="w-3 h-3" />}
                              Reindex
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="px-4 py-3 border-t border-ink-100">
                <Pagination page={indexedPage} totalPages={indexedPages} onPage={setIndexedPage} />
              </div>
            </Card>

            {/* Not indexed */}
            <Card bodyClassName="p-0">
              <div className="flex items-center gap-2 px-5 py-3.5 rounded-t-2xl bg-red-50 border-b border-ink-100">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-bold text-red-600">Not indexed pages</span>
                <Badge tone="red">{notIndexed.length}</Badge>
                <button
                  type="button"
                  onClick={copyNotIndexedUrls}
                  title="Copy all not-indexed URLs"
                  className={cn('ml-1 rounded-lg p-1.5 transition-colors', copied ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100/60 text-red-500 hover:bg-red-100')}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
                {notIndexedSlice.length === 0 ? (
                  <p className="p-8 text-center text-xs text-ink-500">All pages are indexed!</p>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-ink-100">
                        <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-500">#</th>
                        <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-500">URL</th>
                        <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setNotIndexedSort((s) => (s === 'none' ? 'oldest' : s === 'oldest' ? 'newest' : 'none'));
                              setNotIndexedPage(1);
                            }}
                            className={cn('inline-flex items-center gap-1 uppercase tracking-wider', notIndexedSort === 'none' ? 'text-ink-500' : 'text-red-500')}
                            title={
                              notIndexedSort === 'none'
                                ? 'Sort by publish age — click: oldest un-indexed posts first'
                                : notIndexedSort === 'oldest'
                                  ? 'Oldest published first — click: newest first'
                                  : 'Newest published first — click: clear sort'
                            }
                          >
                            Status
                            {notIndexedSort === 'oldest' ? <ChevronDown className="w-3 h-3" /> : notIndexedSort === 'newest' ? <ChevronUp className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                          </button>
                        </th>
                        <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-500 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {notIndexedSlice.map((row, i) => {
                        const age = publishedAgo(row.published_at);
                        return (
                          <tr key={row.url} className="hover:bg-ink-50/60">
                            <td className="px-4 py-2.5 font-mono text-xs text-ink-300">{(notIndexedPage - 1) * PER_PAGE + i + 1}</td>
                            <td className="px-4 py-2.5">
                              <a href={row.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-[240px] items-center gap-1 truncate text-xs font-semibold text-ink-900 hover:underline">
                                <span className="truncate">{extractPath(row.url)}</span>
                                <ExternalLink className="w-3 h-3 shrink-0 opacity-40" />
                              </a>
                              {row.index_requested_at && (
                                <p className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-600">
                                  <Send className="w-2.5 h-2.5" /> Google {timeAgo(row.index_requested_at)}
                                </p>
                              )}
                              {row.indexnow_requested_at && (
                                <p className="mt-0.5 flex items-center gap-1 text-[10px] text-sky-600">
                                  <Zap className="w-2.5 h-2.5" /> IndexNow {timeAgo(row.indexnow_requested_at)}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span
                                title={row.coverage_state || ''}
                                className={cn(
                                  'inline-block max-w-[140px] truncate rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                  row.status === 'error' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
                                )}
                              >
                                {row.status === 'error' ? 'Error: ' : ''}
                                {(row.coverage_state || (row.checked_at ? 'Unknown' : 'Not checked yet')).slice(0, 40)}
                              </span>
                              {age && (
                                <p className="mt-1 flex items-center justify-center gap-1 text-[10px] text-ink-500">
                                  <Clock className="w-2.5 h-2.5" /> {age}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => requestIndex(row.url)}
                                  disabled={!googleReady || busy === row.url}
                                  title={googleReady ? 'Google Indexing API' : 'Google is not configured'}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                >
                                  {busy === row.url ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                  Google
                                </button>
                                <button
                                  type="button"
                                  onClick={() => submitSingleIndexNow(row.url)}
                                  disabled={!indexNowReady || busy === `indexnow-${row.url}`}
                                  title={indexNowReady ? 'Submit via IndexNow' : 'IndexNow is not configured (INDEXNOW_KEY)'}
                                  className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                                >
                                  {busy === `indexnow-${row.url}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                  IndexNow
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="px-4 py-3 border-t border-ink-100">
                <Pagination page={notIndexedPage} totalPages={notIndexedPages} onPage={setNotIndexedPage} />
              </div>
            </Card>
          </div>

          {results.some((r) => r.status === 'error') && (
            <Notice tone="warning" title="Some URLs could not be inspected">
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> They are listed under “Not indexed” with the API error. Re-run the scan to retry them.
              </span>
            </Notice>
          )}
        </>
      )}
    </div>
  );
}
