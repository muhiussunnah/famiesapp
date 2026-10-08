'use client';

import { useState, useRef, useSyncExternalStore, Fragment } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ShieldCheck, RefreshCw, AlertTriangle, AlertCircle, Info, CheckCircle2, ChevronDown, ChevronRight,
  ChevronUp, Search, Globe, FileText, Share2, Type, ImageIcon, Zap, Code2, ArrowUpRight, XCircle,
  ExternalLink, Play, Square, Link2, Download, ArrowUpDown, Pencil, Database, CalendarClock, AtSign,
} from 'lucide-react';
import { PageHeader, Card, Button, Input, Select, Toggle, Badge, Notice, StatCard, EmptyState } from '@/components/admin/ui';
import { cn } from '@/lib/utils';

/* ─────────────── Constants ─────────────── */

const API = '/api/admin/seo-health';
const CRAWL_BATCH = 20;
const STORAGE_KEY = 'famies-seo-health-v1';
const WEIGHT = { critical: 3, warning: 2, info: 1 };
const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };
const CONTENT_MAX = 30;
const PAGE_MAX = 35;

// How many distinct checks each category can fail, per item — used for
// the category breakdown percentages.
const CONTENT_CATEGORY_CHECKS = {
  'Meta Tags': 7, Images: 4, Headings: 3, Content: 1, 'URL / Slug': 4,
  'Internal Links': 5, 'Structured Data': 1, Publishing: 1,
};
const PAGE_CATEGORY_CHECKS = {
  'Meta Tags': 8, 'Open Graph': 5, 'Twitter Cards': 4, Headings: 3, Images: 2,
  'Structured Data': 4, Technical: 8, Performance: 2, 'Internal Links': 1,
};

const EMPTY_SCAN = { content: null, urls: [], pages: [], serverGlobal: [], scannedAt: '' };

/* ─────────────── Saved scan (localStorage, per browser) ─────────────── */

let cachedRaw;
let cachedScan = null;
function readSavedScan() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedScan = raw ? { ...EMPTY_SCAN, ...JSON.parse(raw) } : null;
    }
    return cachedScan;
  } catch {
    return null;
  }
}
function subscribeSavedScan(callback) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}
function saveScan(scan) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scan));
  } catch {
    /* quota / private mode — results still show for this session */
  }
}

/* ─────────────── Severity + score helpers ─────────────── */

function SeverityIcon({ severity, className = 'w-4 h-4' }) {
  if (severity === 'critical') return <XCircle className={cn(className, 'text-red-500')} />;
  if (severity === 'warning') return <AlertTriangle className={cn(className, 'text-amber-500')} />;
  if (severity === 'info') return <Info className={cn(className, 'text-sky-500')} />;
  return <CheckCircle2 className={cn(className, 'text-emerald-500')} />;
}

const SEVERITY_TONE = { critical: 'red', warning: 'amber', info: 'blue', passed: 'green' };

function scoreHex(score) {
  if (score >= 90) return '#10b981';
  if (score >= 70) return '#f59e0b';
  if (score >= 50) return '#f97316';
  return '#ef4444';
}
function scoreTone(score) {
  if (score >= 90) return 'green';
  if (score >= 70) return 'amber';
  return 'red';
}
function scoreLabel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs work';
  return 'Critical issues';
}

const CATEGORY_ICONS = {
  'Meta Tags': FileText, 'Open Graph': Share2, 'Twitter Cards': AtSign, Headings: Type, Images: ImageIcon,
  'Structured Data': Code2, Technical: ShieldCheck, Performance: Zap, 'Internal Links': Link2,
  Content: FileText, 'URL / Slug': Globe, Publishing: CalendarClock,
};

// Generic labels for the grouped "Top issues" list (per-item messages
// contain item-specific numbers).
const CHECK_LABELS = {
  'no-meta-title': 'No custom SEO title',
  'missing-title': 'Missing title',
  'seo-title-short': 'SEO title too short',
  'seo-title-long': 'SEO title too long',
  'title-short': 'Title too short',
  'title-long': 'Title too long',
  'missing-description': 'Missing meta description',
  'description-from-excerpt': 'Meta description falls back to the excerpt',
  'desc-short': 'Meta description too short',
  'desc-long': 'Meta description too long',
  'duplicate-title': 'Duplicate titles',
  'duplicate-description': 'Duplicate meta descriptions',
  'no-featured-image': 'No featured image',
  'featured-image-fallback': 'Featured image falls back to a content image',
  'img-missing-alt': 'Images missing alt text',
  'img-empty-alt': 'Images with empty alt text',
  'img-insecure': 'Images loaded over http://',
  'content-h1': 'H1 inside the content',
  'missing-h1': 'Missing H1',
  'multiple-h1': 'Multiple H1 tags',
  'missing-h2': 'No H2 headings',
  'heading-skip': 'Heading levels skipped',
  'thin-content': 'Thin content',
  'empty-content': 'Empty content',
  'slug-not-normalized': 'Slug is not a clean URL',
  'slug-reserved': 'Slug collides with a built-in route',
  'slug-duplicate': 'Duplicate slugs',
  'slug-nested': 'Nested slugs',
  'slug-long': 'Long slugs',
  'broken-internal-links': 'Broken internal links',
  'links-to-unpublished': 'Links to unpublished posts',
  'legacy-internal-links': 'Old /inspiration/<slug> links',
  'internal-links-origin': 'Internal links on http:// or www.',
  'low-internal-links': 'Few internal links',
  'invalid-custom-schema': 'Invalid custom schema JSON',
  'wrong-host': 'Absolute URLs on the wrong host',
  'canonical-other-page': 'Canonical points to another page',
  'missing-canonical': 'Missing canonical URL',
  'missing-jsonld': 'No structured data',
  'duplicate-schema': 'Duplicate schema types',
  'has-noindex': 'Pages with noindex',
  'http-error': 'Pages returning HTTP errors',
  unreachable: 'Unreachable pages',
  redirected: 'Redirecting URLs',
  'slow-load': 'Slow pages',
};

const countBy = (issues, severity) => issues.filter((i) => i.severity === severity).length;
const sortIssues = (issues) => [...issues].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2));
const editHref = (id) => `/admin/pages/edit?id=${id}`;
const titleCase = (s) => s.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

/* ─────────────── Checks derived from all crawled pages ─────────────── */

function pageDerivedChecks(pages, urls) {
  if (!pages.length) return [];
  const checks = [];
  const push = (check, severity, passed, message, fix) => checks.push({ check, severity, passed, message, fix });
  const ok = pages.filter((p) => p.status === 200);

  const titles = ok.map((p) => p.title).filter(Boolean);
  const dupTitles = titles.length - new Set(titles.map((t) => t.toLowerCase())).size;
  push('unique-titles', 'critical', dupTitles === 0, dupTitles === 0 ? 'All page titles are unique' : `${dupTitles} duplicate title(s) found`, 'Make sure every page has a unique <title>');

  const descs = ok.map((p) => p.description).filter(Boolean);
  const dupDescs = descs.length - new Set(descs.map((d) => d.toLowerCase())).size;
  push('unique-descriptions', 'warning', dupDescs === 0, dupDescs === 0 ? 'All meta descriptions are unique' : `${dupDescs} duplicate meta description(s) found`, 'Write a unique meta description for every page');

  const http = pages.filter((p) => p.url.startsWith('http://'));
  push('https-enforced', 'critical', http.length === 0, http.length === 0 ? 'All pages use HTTPS' : `${http.length} page(s) using HTTP`, 'Serve and list every URL over HTTPS');

  const broken = pages.filter((p) => p.status === 0 || p.status >= 400);
  push('no-broken-pages', 'warning', broken.length === 0, broken.length === 0 ? 'No broken pages found' : `${broken.length} page(s) returned errors`, 'Fix or remove broken URLs from the sitemap');

  const canon = pages.filter((p) => p.issues.some((i) => i.check === 'relative-canonical' || i.check === 'missing-canonical'));
  push('consistent-canonicals', 'warning', canon.length === 0, canon.length === 0 ? 'All pages have proper canonical URLs' : `${canon.length} page(s) with canonical issues`, 'Give every page an absolute canonical URL');

  const total = urls.length || pages.length;
  push('crawl-coverage', 'warning', ok.length === total, `${ok.length}/${total} public URLs crawled successfully`, 'Crawl the remaining pages and fix any that fail');
  return checks;
}

/* ─────────────── Aggregation ─────────────── */

function aggregate(posts, pages, globalChecks) {
  const items = [
    ...posts.map((p) => ({ issues: p.issues, max: CONTENT_MAX, cats: CONTENT_CATEGORY_CHECKS, ok: true })),
    ...pages.map((p) => ({ issues: p.issues, max: PAGE_MAX, cats: PAGE_CATEGORY_CHECKS, ok: p.status > 0 && p.status < 400 })),
  ];
  const all = items.flatMap((i) => i.issues);

  let maxPts = 0;
  let earned = 0;
  const categories = {};
  for (const item of items) {
    const lost = item.issues.reduce((s, i) => s + (WEIGHT[i.severity] || 0), 0);
    maxPts += item.max;
    earned += item.ok ? Math.max(0, item.max - lost) : 0;
    if (!item.ok) continue;
    for (const [cat, n] of Object.entries(item.cats)) {
      if (!categories[cat]) categories[cat] = { total: 0, passed: 0 };
      categories[cat].total += n;
      categories[cat].passed += Math.max(0, n - item.issues.filter((i) => i.category === cat).length);
    }
  }
  for (const gc of globalChecks) {
    const w = WEIGHT[gc.severity] || 1;
    maxPts += w;
    if (gc.passed) earned += w;
  }

  return {
    score: maxPts > 0 ? Math.round((earned / maxPts) * 100) : 100,
    totalIssues: all.length,
    criticalCount: countBy(all, 'critical'),
    warningCount: countBy(all, 'warning'),
    infoCount: countBy(all, 'info'),
    passedItems: posts.filter((p) => !countBy(p.issues, 'critical')).length + pages.filter((p) => p.status === 200 && !countBy(p.issues, 'critical')).length,
    categories,
  };
}

/** Most common issues across posts (source: content) and crawled pages (source: live). */
function topIssues(posts, pages) {
  const freq = new Map();
  const add = (source, issue, target) => {
    const key = `${source}:${issue.check}`;
    if (!freq.has(key)) freq.set(key, { key, source, issue, targets: [] });
    freq.get(key).targets.push(target);
  };
  for (const p of posts) for (const i of p.issues) add('content', i, { label: p.slug || p.title, postId: p.id, url: p.url });
  for (const p of pages) for (const i of p.issues) add('live', i, { label: p.path || '/', postId: p.postId, url: p.url });
  return [...freq.values()]
    .sort((a, b) => (SEVERITY_ORDER[a.issue.severity] - SEVERITY_ORDER[b.issue.severity]) * 1000 + (b.targets.length - a.targets.length))
    .slice(0, 20);
}

/* ─────────────── Small UI pieces ─────────────── */

function ScoreRing({ score, size = 150, stroke = 10 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#efedf3" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={scoreHex(score)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - (score / 100) * circ}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black" style={{ color: scoreHex(score) }}>{score}</span>
        <span className="text-xs font-semibold text-ink-300">/ 100</span>
      </div>
    </div>
  );
}

function ProgressBar({ pct, className }) {
  return (
    <div className={cn('w-full h-2 rounded-full bg-ink-100 overflow-hidden', className)}>
      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function IssueList({ issues }) {
  if (!issues.length) {
    return (
      <div className="px-6 py-6 text-center">
        <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
        <p className="text-sm font-bold text-emerald-600">All checks passed</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-ink-100">
      {sortIssues(issues).map((issue, idx) => (
        <li key={issue.check + idx} className="flex items-start gap-3 px-6 py-3">
          <SeverityIcon severity={issue.severity} className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold text-ink-900">{issue.message}</span>
              <Badge tone={SEVERITY_TONE[issue.severity]}>{issue.category}</Badge>
            </div>
            <p className="mt-0.5 text-[12px] text-ink-500">
              <ArrowUpRight className="inline w-3 h-3 mr-1 text-primary" />
              {issue.fix}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SortHeader({ field, label, sort, onSort, className }) {
  const active = sort.field === field;
  return (
    <button type="button" onClick={() => onSort(field)} className={cn('inline-flex items-center justify-center gap-1 uppercase tracking-wide hover:text-ink-900', active ? 'text-ink-900' : 'text-ink-500', className)}>
      {label}
      {!active ? <ArrowUpDown className="w-3 h-3 opacity-40" /> : sort.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
    </button>
  );
}

function EditLink({ postId }) {
  if (postId == null) return null;
  return (
    <Link
      href={editHref(postId)}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-primary-700 bg-primary/10 hover:bg-primary/20"
    >
      <Pencil className="w-3 h-3" /> Edit
    </Link>
  );
}

function sortValue(item, field) {
  switch (field) {
    case 'score': return item.score;
    case 'size': return item.htmlSize || 0;
    case 'words': return item.words || 0;
    case 'critical': return countBy(item.issues, 'critical');
    case 'warn': return countBy(item.issues, 'warning');
    case 'info': return countBy(item.issues, 'info');
    default: return 0;
  }
}

function csvCell(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/* ═══════════════════════════════ Page ═══════════════════════════════ */

export default function SeoHealthPage() {
  const saved = useSyncExternalStore(subscribeSavedScan, readSavedScan, () => null);
  const [current, setCurrent] = useState(null);
  const scan = current ?? saved ?? EMPTY_SCAN;

  const [phase, setPhase] = useState(null); // 'content' | 'global' | 'urls' | 'crawl' | null
  const [error, setError] = useState('');
  const stopRef = useRef(false);
  const [tab, setTab] = useState('overview');
  const [expanded, setExpanded] = useState(null);
  const [expandedIssue, setExpandedIssue] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [sort, setSort] = useState({ field: 'score', dir: 'asc' });

  const running = phase !== null;
  const posts = scan.content?.posts ?? [];
  const pages = scan.pages;
  const hasResults = !!scan.content || pages.length > 0;
  const totalUrls = scan.urls.length;
  const crawled = pages.length;
  const remaining = Math.max(0, totalUrls - crawled);
  const globalChecks = [...scan.serverGlobal, ...pageDerivedChecks(pages, scan.urls)];
  const stats = hasResults ? aggregate(posts, pages, globalChecks) : null;
  const top = hasResults ? topIssues(posts, pages) : [];

  const commit = (next) => {
    setCurrent(next);
    saveScan(next);
  };

  const call = async (body) => {
    const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  };

  /** Crawl the remaining URLs of `acc` in batches until done or stopped. */
  const crawl = async (start) => {
    let acc = start;
    setPhase('crawl');
    stopRef.current = false;
    const postIdByUrl = new Map(acc.urls.map((u) => [u.url, u.postId]));
    while (!stopRef.current && acc.pages.length < acc.urls.length) {
      const batch = acc.urls.slice(acc.pages.length, acc.pages.length + CRAWL_BATCH).map((u) => u.url);
      const data = await call({ action: 'scan', urls: batch });
      const scanned = data.pages.map((p) => ({ ...p, postId: postIdByUrl.get(p.url) ?? null }));
      // Keep the URL list aligned even if the server skipped one.
      const got = new Set(scanned.map((p) => p.url));
      const skipped = batch.filter((u) => !got.has(u)).map((url) => ({
        url, path: new URL(url).pathname, postId: postIdByUrl.get(url) ?? null, status: 0, loadTime: 0, htmlSize: 0, title: '', description: '',
        issues: [{ check: 'unreachable', severity: 'critical', message: 'URL was skipped by the scanner', fix: 'Check that the URL is on the site domain', category: 'Technical' }],
        score: 0,
      }));
      acc = { ...acc, pages: [...acc.pages, ...scanned, ...skipped], scannedAt: data.scannedAt };
      commit(acc);
    }
    return acc;
  };

  const runAudit = async () => {
    setError('');
    setExpanded(null);
    stopRef.current = false;
    let acc = { ...EMPTY_SCAN, scannedAt: new Date().toISOString() };
    try {
      setPhase('content');
      const content = await call({ action: 'content' });
      acc = { ...acc, content: { posts: content.posts, totals: content.totals } };
      commit(acc);

      setPhase('global');
      const global = await call({ action: 'global' });
      acc = { ...acc, serverGlobal: global.globalChecks || [] };
      commit(acc);

      setPhase('urls');
      const list = await call({ action: 'urls' });
      acc = { ...acc, urls: list.urls || [] };
      commit(acc);

      acc = await crawl(acc);
      toast.success(stopRef.current ? 'Audit paused' : 'SEO audit complete');
    } catch (err) {
      setError(err.message || 'Audit failed');
      toast.error('SEO audit failed');
    } finally {
      setPhase(null);
    }
  };

  const resumeCrawl = async () => {
    setError('');
    try {
      await crawl(scan);
      if (!stopRef.current) toast.success('Crawl complete');
    } catch (err) {
      setError(`${err.message || 'Batch failed'} — click "Resume crawl" to retry.`);
    } finally {
      setPhase(null);
    }
  };

  const stop = () => {
    stopRef.current = true;
  };

  const onSort = (field) => {
    setSort((s) => (s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: field === 'score' ? 'asc' : 'desc' }));
  };
  const sorted = (items) =>
    [...items].sort((a, b) => {
      const d = sortValue(a, sort.field) - sortValue(b, sort.field);
      return sort.dir === 'asc' ? d : -d;
    });

  const q = search.trim().toLowerCase();
  const filteredPosts = sorted(posts).filter((p) => {
    if (statusFilter === 'live' && !p.live) return false;
    if (statusFilter === 'unpublished' && p.live) return false;
    if (onlyIssues && !p.issues.some((i) => i.severity !== 'info')) return false;
    return !q || (p.title || '').toLowerCase().includes(q) || (p.slug || '').toLowerCase().includes(q);
  });
  const filteredPages = sorted(pages).filter((p) => {
    if (onlyIssues && !p.issues.some((i) => i.severity !== 'info')) return false;
    return !q || (p.path || '').toLowerCase().includes(q) || (p.title || '').toLowerCase().includes(q);
  });

  const exportCSV = () => {
    const rows = [['Type', 'Page', 'URL', 'Status', 'Score', 'Words / Size (KB)', 'Critical', 'Warnings', 'Info', 'Edit', 'Issues']];
    const issueText = (issues) =>
      sortIssues(issues).map((i) => `[${i.severity.toUpperCase()}] ${i.category}: ${i.message} → Fix: ${i.fix}`).join(' | ') || 'All checks passed';
    for (const p of sorted(posts)) {
      rows.push(['Content', p.title, p.url || '', p.status, p.score, p.words, countBy(p.issues, 'critical'), countBy(p.issues, 'warning'), countBy(p.issues, 'info'), `${window.location.origin}${editHref(p.id)}`, issueText(p.issues)]);
    }
    for (const p of sorted(pages)) {
      rows.push(['Live page', p.path || '/', p.url, p.status, p.score, Math.round((p.htmlSize || 0) / 1024), countBy(p.issues, 'critical'), countBy(p.issues, 'warning'), countBy(p.issues, 'info'), p.postId != null ? `${window.location.origin}${editHref(p.postId)}` : '', issueText(p.issues)]);
    }
    rows.push([]);
    rows.push(['--- GLOBAL CHECKS ---']);
    rows.push(['Check', 'Status', 'Severity', 'Message', 'Fix']);
    for (const gc of globalChecks) rows.push([titleCase(gc.check), gc.passed ? 'PASSED' : 'FAILED', gc.severity, gc.message, gc.passed ? '' : gc.fix]);

    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `famies-seo-health-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const phaseLabel = {
    content: 'Checking every post in the database…',
    global: 'Checking robots.txt, sitemap and site-wide settings…',
    urls: 'Collecting public URLs…',
    crawl: `Crawling live pages… ${crawled} / ${totalUrls}`,
  }[phase];

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'content', label: `Content (${posts.length})` },
    { id: 'pages', label: `Live pages (${crawled})` },
    { id: 'global', label: `Global checks (${globalChecks.length})` },
  ];

  return (
    <div>
      <PageHeader
        icon={ShieldCheck}
        title="SEO Health"
        description="Technical SEO audit of every post in the database plus the live, rendered pages of famies.app — titles, meta descriptions, images, headings, thin content, slugs, internal links, structured data and site-wide settings."
        actions={
          <>
            {hasResults && (
              <Button variant="secondary" icon={Download} onClick={exportCSV} disabled={running}>
                Export CSV
              </Button>
            )}
            <Button variant="accent" icon={RefreshCw} loading={running && phase !== 'crawl'} onClick={runAudit} disabled={running}>
              {hasResults ? 'Re-run audit' : 'Run audit'}
            </Button>
          </>
        }
      />

      {error && (
        <Notice tone="error" title="Audit error" className="mb-6">
          {error}
        </Notice>
      )}

      {/* Empty state */}
      {!hasResults && !running && (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="Ready to scan"
            text={`Checks every post in the database, then crawls the homepage, static pages and every live post in batches of ${CRAWL_BATCH}. Results are saved in this browser.`}
            action={<Button variant="accent" icon={ShieldCheck} onClick={runAudit}>Start SEO audit</Button>}
          />
        </Card>
      )}

      {/* Progress */}
      {(running || (hasResults && remaining > 0)) && (
        <Card className="mb-4" bodyClassName="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-sm font-bold text-ink-900">
                  {running ? phaseLabel : `${crawled} / ${totalUrls} live pages crawled`}
                </span>
                {!running && remaining > 0 && <Badge tone="amber">{remaining} remaining</Badge>}
                {running && <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />}
              </div>
              <ProgressBar pct={totalUrls ? (crawled / totalUrls) * 100 : phase === 'content' ? 10 : phase === 'global' ? 20 : 30} />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {phase === 'crawl' ? (
                <Button variant="danger" size="sm" icon={Square} onClick={stop}>
                  Stop
                </Button>
              ) : (
                !running && remaining > 0 && (
                  <Button variant="primary" size="sm" icon={Play} onClick={resumeCrawl}>
                    Resume crawl ({remaining})
                  </Button>
                )
              )}
            </div>
          </div>
        </Card>
      )}

      {hasResults && stats && (
        <>
          {/* Score hero */}
          <Card className="mb-4" bodyClassName="p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <ScoreRing score={stats.score} />
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-xl font-black text-ink-900">{scoreLabel(stats.score)}</h2>
                <p className="mt-1 text-sm text-ink-500">
                  {posts.length} posts checked · {crawled} live pages crawled · {stats.totalIssues} issues found
                  {remaining > 0 && <span className="ml-1 text-amber-600">({remaining} pages not crawled yet)</span>}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                  <Badge tone="red">{stats.criticalCount} critical</Badge>
                  <Badge tone="amber">{stats.warningCount} warnings</Badge>
                  <Badge tone="blue">{stats.infoCount} info</Badge>
                  <Badge tone="green">{stats.passedItems} without critical issues</Badge>
                </div>
                {scan.scannedAt && <p className="mt-3 text-[11px] text-ink-300">Last scanned: {new Date(scan.scannedAt).toLocaleString()}</p>}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Critical" value={stats.criticalCount} icon={XCircle} tone="pink" />
            <StatCard label="Warnings" value={stats.warningCount} icon={AlertTriangle} tone="amber" />
            <StatCard label="Info" value={stats.infoCount} icon={Info} tone="blue" />
            <StatCard label="Passed" value={stats.passedItems} icon={CheckCircle2} tone="green" hint="Posts + pages with no critical issue" />
          </div>

          {/* Tabs */}
          <div className="mb-6 flex gap-1 rounded-xl bg-ink-50 border border-ink-100 p-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setExpanded(null);
                }}
                className={cn(
                  'flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors',
                  tab === t.id ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-bold text-ink-900">Category breakdown</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(stats.categories).map(([cat, { total, passed }]) => {
                    const pct = total > 0 ? Math.round((passed / total) * 100) : 100;
                    const Icon = CATEGORY_ICONS[cat] || Globe;
                    return (
                      <div key={cat} className="rounded-2xl bg-white border border-ink-100 p-5">
                        <div className="flex items-center gap-2.5 mb-3">
                          <Icon className="w-[18px] h-[18px]" style={{ color: scoreHex(pct) }} />
                          <span className="text-[13px] font-bold text-ink-900">{cat}</span>
                        </div>
                        <div className="flex items-center gap-3 mb-1.5">
                          <div className="flex-1 h-2 rounded-full bg-ink-100 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: scoreHex(pct) }} />
                          </div>
                          <span className="text-xs font-bold" style={{ color: scoreHex(pct) }}>{pct}%</span>
                        </div>
                        <p className="text-[11px] text-ink-500">{passed}/{total} checks passed</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {top.length > 0 && (
                <Card title="Top issues" description="Click an issue to see every affected post or page and jump straight to the editor." bodyClassName="p-0 pt-3">
                  <ul className="divide-y divide-ink-100 border-t border-ink-100">
                    {top.map(({ key, source, issue, targets }) => {
                      const open = expandedIssue === key;
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            onClick={() => setExpandedIssue(open ? null : key)}
                            className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-ink-50"
                          >
                            <SeverityIcon severity={issue.severity} className="w-4 h-4 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                <span className="text-[13px] font-semibold text-ink-900">{targets.length > 1 ? CHECK_LABELS[issue.check] || titleCase(issue.check) : issue.message}</span>
                                <Badge tone={SEVERITY_TONE[issue.severity]}>{issue.severity}</Badge>
                                <Badge tone={source === 'content' ? 'violet' : 'gray'}>{source === 'content' ? 'Content' : 'Live page'}</Badge>
                              </div>
                              <p className="text-xs text-ink-500">{issue.fix}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className="text-lg font-black text-ink-900">{targets.length}</span>
                              <p className="text-[10px] text-ink-500">{source === 'content' ? 'posts' : 'pages'}</p>
                            </div>
                            {open ? <ChevronDown className="w-4 h-4 mt-1 text-ink-300" /> : <ChevronRight className="w-4 h-4 mt-1 text-ink-300" />}
                          </button>
                          {open && (
                            <ul className="bg-ink-50/60 border-t border-ink-100 divide-y divide-ink-100">
                              {targets.slice(0, 100).map((t, i) => (
                                <li key={`${t.label}-${i}`} className="flex items-center justify-between gap-3 px-12 py-2">
                                  <span className="text-[12px] font-medium text-ink-700 truncate">{t.label}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {t.url && (
                                      <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-ink-300 hover:text-ink-900" aria-label="Open page">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                    <EditLink postId={t.postId} />
                                  </div>
                                </li>
                              ))}
                              {targets.length > 100 && <li className="px-12 py-2 text-[11px] text-ink-500">…and {targets.length - 100} more (export CSV for the full list)</li>}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}
            </div>
          )}

          {/* Filters shared by Content + Live pages */}
          {(tab === 'content' || tab === 'pages') && (
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300 pointer-events-none" />
                <Input className="pl-10" placeholder={tab === 'content' ? 'Search posts by title or slug…' : 'Search pages…'} value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {tab === 'content' && (
                <Select className="sm:w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All posts</option>
                  <option value="live">Live only</option>
                  <option value="unpublished">Drafts & scheduled</option>
                </Select>
              )}
              <Toggle checked={onlyIssues} onChange={setOnlyIssues} label="Only with problems" />
            </div>
          )}

          {/* ── Content (database) ── */}
          {tab === 'content' && (
            <Card bodyClassName="p-0">
              {!scan.content ? (
                <EmptyState icon={Database} title="No content audit yet" text="Run the audit to check every post in the database." />
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[760px]">
                    <div className="grid items-center px-5 py-3 text-[11px] font-bold border-b border-ink-100 bg-ink-50/60 rounded-t-2xl" style={{ gridTemplateColumns: '1fr 90px 70px 70px 64px 64px 64px 70px' }}>
                      <span className="uppercase tracking-wide text-ink-500">Post</span>
                      <span className="text-center uppercase tracking-wide text-ink-500">Status</span>
                      <SortHeader field="words" label="Words" sort={sort} onSort={onSort} />
                      <SortHeader field="score" label="Score" sort={sort} onSort={onSort} />
                      <SortHeader field="critical" label="Crit" sort={sort} onSort={onSort} />
                      <SortHeader field="warn" label="Warn" sort={sort} onSort={onSort} />
                      <SortHeader field="info" label="Info" sort={sort} onSort={onSort} />
                      <span />
                    </div>
                    <div className="max-h-[640px] overflow-y-auto divide-y divide-ink-100">
                      {filteredPosts.map((p) => {
                        const open = expanded === `post-${p.id}`;
                        const c = countBy(p.issues, 'critical');
                        const w = countBy(p.issues, 'warning');
                        const i = countBy(p.issues, 'info');
                        return (
                          <Fragment key={p.id}>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => setExpanded(open ? null : `post-${p.id}`)}
                              onKeyDown={(e) => e.key === 'Enter' && setExpanded(open ? null : `post-${p.id}`)}
                              className={cn('grid items-center px-5 py-3 cursor-pointer hover:bg-ink-50', open && 'bg-primary/5')}
                              style={{ gridTemplateColumns: '1fr 90px 70px 70px 64px 64px 64px 70px' }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {open ? <ChevronDown className="w-3.5 h-3.5 text-ink-300 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-ink-300 shrink-0" />}
                                <div className="min-w-0">
                                  <p className="text-[13px] font-semibold text-ink-900 truncate">{p.title || '(untitled)'}</p>
                                  <p className="text-[11px] text-ink-300 truncate">{p.slug || '— no slug —'}</p>
                                </div>
                              </div>
                              <div className="text-center">
                                <Badge tone={p.live ? 'green' : p.status === 'scheduled' ? 'blue' : 'gray'}>{p.live ? 'live' : p.status}</Badge>
                              </div>
                              <span className={cn('text-center text-xs font-semibold', p.words < 300 ? 'text-amber-600' : 'text-ink-500')}>{p.words}</span>
                              <div className="text-center"><Badge tone={scoreTone(p.score)}>{p.score}</Badge></div>
                              <span className={cn('text-center text-xs font-bold', c ? 'text-red-500' : 'text-ink-200')}>{c}</span>
                              <span className={cn('text-center text-xs font-bold', w ? 'text-amber-500' : 'text-ink-200')}>{w}</span>
                              <span className={cn('text-center text-xs font-bold', i ? 'text-sky-500' : 'text-ink-200')}>{i}</span>
                              <div className="text-right"><EditLink postId={p.id} /></div>
                            </div>
                            {open && (
                              <div className="bg-ink-50/50">
                                <div className="flex flex-wrap gap-4 px-6 py-2.5 text-[11px] text-ink-500 border-b border-ink-100">
                                  <span>Layout: <strong className="text-ink-700">{p.layout || '—'}</strong></span>
                                  <span>Words: <strong className="text-ink-700">{p.words}</strong></span>
                                  {p.updatedAt && <span>Updated: <strong className="text-ink-700">{new Date(p.updatedAt).toLocaleDateString()}</strong></span>}
                                  {p.live && p.url && (
                                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:underline">
                                      Open page <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                  <Link href={editHref(p.id)} className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:underline">
                                    Fix in editor <Pencil className="w-3 h-3" />
                                  </Link>
                                </div>
                                <IssueList issues={p.issues} />
                              </div>
                            )}
                          </Fragment>
                        );
                      })}
                      {filteredPosts.length === 0 && <p className="px-5 py-12 text-center text-sm text-ink-500">No posts match these filters.</p>}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ── Live pages (crawl) ── */}
          {tab === 'pages' && (
            <Card bodyClassName="p-0">
              {pages.length === 0 ? (
                <EmptyState icon={Globe} title="No pages crawled yet" text={running ? 'The crawl is starting…' : 'Run the audit (or resume the crawl) to check the rendered pages.'} />
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[760px]">
                    <div className="grid items-center px-5 py-3 text-[11px] font-bold border-b border-ink-100 bg-ink-50/60 rounded-t-2xl" style={{ gridTemplateColumns: '1fr 70px 70px 64px 64px 64px 60px 70px' }}>
                      <span className="uppercase tracking-wide text-ink-500">Page</span>
                      <SortHeader field="score" label="Score" sort={sort} onSort={onSort} />
                      <SortHeader field="size" label="Size" sort={sort} onSort={onSort} />
                      <SortHeader field="critical" label="Crit" sort={sort} onSort={onSort} />
                      <SortHeader field="warn" label="Warn" sort={sort} onSort={onSort} />
                      <SortHeader field="info" label="Info" sort={sort} onSort={onSort} />
                      <span className="text-center uppercase tracking-wide text-ink-500">Status</span>
                      <span />
                    </div>
                    <div className="max-h-[640px] overflow-y-auto divide-y divide-ink-100">
                      {filteredPages.map((p) => {
                        const open = expanded === `page-${p.url}`;
                        const c = countBy(p.issues, 'critical');
                        const w = countBy(p.issues, 'warning');
                        const i = countBy(p.issues, 'info');
                        const size = p.htmlSize || 0;
                        return (
                          <Fragment key={p.url}>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => setExpanded(open ? null : `page-${p.url}`)}
                              onKeyDown={(e) => e.key === 'Enter' && setExpanded(open ? null : `page-${p.url}`)}
                              className={cn('grid items-center px-5 py-3 cursor-pointer hover:bg-ink-50', open && 'bg-primary/5')}
                              style={{ gridTemplateColumns: '1fr 70px 70px 64px 64px 64px 60px 70px' }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {open ? <ChevronDown className="w-3.5 h-3.5 text-ink-300 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-ink-300 shrink-0" />}
                                <div className="min-w-0">
                                  <p className="text-[13px] font-semibold text-ink-900 truncate">{p.path || '/'}</p>
                                  {p.title && <p className="text-[11px] text-ink-300 truncate">{p.title}</p>}
                                </div>
                              </div>
                              <div className="text-center"><Badge tone={scoreTone(p.score)}>{p.score}</Badge></div>
                              <span className={cn('text-center text-[11px] font-semibold', size > 2097152 ? 'text-red-500' : size > 1572864 ? 'text-amber-500' : 'text-ink-500')}>
                                {size > 0 ? (size > 1048576 ? `${(size / 1048576).toFixed(1)}MB` : `${Math.round(size / 1024)}KB`) : '—'}
                              </span>
                              <span className={cn('text-center text-xs font-bold', c ? 'text-red-500' : 'text-ink-200')}>{c}</span>
                              <span className={cn('text-center text-xs font-bold', w ? 'text-amber-500' : 'text-ink-200')}>{w}</span>
                              <span className={cn('text-center text-xs font-bold', i ? 'text-sky-500' : 'text-ink-200')}>{i}</span>
                              <div className="flex justify-center">
                                {p.status === 200 && c === 0 ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                ) : p.status === 0 || p.status >= 400 ? (
                                  <XCircle className="w-4 h-4 text-red-500" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-amber-500" />
                                )}
                              </div>
                              <div className="text-right"><EditLink postId={p.postId} /></div>
                            </div>
                            {open && (
                              <div className="bg-ink-50/50">
                                <div className="flex flex-wrap gap-4 px-6 py-2.5 text-[11px] text-ink-500 border-b border-ink-100">
                                  <span>HTTP: <strong className={p.status === 200 ? 'text-emerald-600' : 'text-red-500'}>{p.status || 'Error'}</strong></span>
                                  <span>Load time: <strong className="text-ink-700">{p.loadTime > 0 ? `${(p.loadTime / 1000).toFixed(1)}s` : 'N/A'}</strong></span>
                                  <span>HTML size: <strong className="text-ink-700">{size > 0 ? `${Math.round(size / 1024)}KB` : 'N/A'}</strong></span>
                                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:underline">
                                    Open page <ExternalLink className="w-3 h-3" />
                                  </a>
                                  {p.postId != null && (
                                    <Link href={editHref(p.postId)} className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:underline">
                                      Fix in editor <Pencil className="w-3 h-3" />
                                    </Link>
                                  )}
                                </div>
                                <IssueList issues={p.issues} />
                              </div>
                            )}
                          </Fragment>
                        );
                      })}
                      {filteredPages.length === 0 && <p className="px-5 py-12 text-center text-sm text-ink-500">No pages match your search.</p>}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ── Global checks ── */}
          {tab === 'global' && (
            <Card bodyClassName="p-0">
              {globalChecks.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-ink-500">Global checks run as part of the audit.</p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {globalChecks.map((gc) => (
                    <li key={gc.check} className="flex items-start gap-4 px-5 py-4">
                      <SeverityIcon severity={gc.passed ? 'passed' : gc.severity} className="w-[18px] h-[18px] mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span className="text-[13px] font-bold text-ink-900">{titleCase(gc.check)}</span>
                          <Badge tone={gc.passed ? 'green' : SEVERITY_TONE[gc.severity]}>{gc.passed ? 'Passed' : gc.severity}</Badge>
                        </div>
                        <p className="text-xs text-ink-500">{gc.message}</p>
                        {!gc.passed && (
                          <p className="mt-1 text-[11px] text-ink-500">
                            <ArrowUpRight className="inline w-3 h-3 mr-1 text-primary" />
                            {gc.fix}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
