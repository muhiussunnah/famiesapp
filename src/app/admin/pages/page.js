'use client';
/**
 * /admin/pages — every article / standalone page in blog_posts, with status
 * tabs, search, pagination, view counts and internal-link counts.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Plus, Pencil, Trash2, Loader2, Link2, ChevronLeft, ChevronRight, Search, ExternalLink,
  FileText, CalendarClock, X, Eye,
} from 'lucide-react';
import { PageHeader, Card, Badge, EmptyState, Notice } from '@/components/admin/ui';
import ClearCacheButton from '@/components/admin/ClearCacheButton';
import { useModal } from '@/components/admin/AdminModal';
import { absoluteUrl } from '@/lib/site';
import { cn } from '@/lib/utils';

const TABS = [
  { value: 'all', label: 'All', countKey: null, dot: null, title: 'Every page regardless of status' },
  { value: 'published', label: 'Published', countKey: 'publishedCount', dot: 'bg-emerald-500', title: 'Live on the public site' },
  { value: 'draft', label: 'Drafts', countKey: 'draftCount', dot: 'bg-amber-500', title: 'Saved but not published' },
  { value: 'scheduled', label: 'Scheduled', countKey: 'scheduledCount', dot: 'bg-sky-500', title: 'Publishes automatically at the scheduled time' },
];

const STATUS_TONES = { published: 'green', draft: 'amber', scheduled: 'blue' };

function buildUrl(page, status, q) {
  const qs = new URLSearchParams({ page: String(page) });
  if (status !== 'all') qs.set('status', status);
  if (q) qs.set('q', q);
  return `/api/admin/posts?${qs.toString()}`;
}

function formatDate(iso, withTime = false) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

/** Up to 5 page numbers centred on the current page. */
function pageWindow(page, totalPages) {
  const size = 5;
  let start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + size - 1);
  start = Math.max(1, end - size + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function LinksBadge({ count }) {
  const tone = count >= 5 ? 'green' : count >= 1 ? 'amber' : 'red';
  return (
    <span title={`${count} internal ${count === 1 ? 'link' : 'links'}`}>
      <Badge tone={tone}>
        <Link2 className="w-3 h-3" />
        {count}
      </Badge>
    </span>
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-ink-100">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-ink-100" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-ink-100" />
          </div>
          <div className="hidden h-3 w-20 animate-pulse rounded bg-ink-100 md:block" />
          <div className="hidden h-3 w-16 animate-pulse rounded bg-ink-100 lg:block" />
          <div className="hidden h-3 w-20 animate-pulse rounded bg-ink-100 md:block" />
          <div className="h-3 w-12 animate-pulse rounded bg-ink-100" />
        </div>
      ))}
    </div>
  );
}

const iconBtn = 'p-2 rounded-lg text-ink-300 transition-colors hover:bg-ink-50 hover:text-ink-900';

export default function AdminPagesPage() {
  const { showConfirm } = useModal();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState(null); // { key, data, error, fetchedAt }
  const [deleting, setDeleting] = useState(null);

  const url = buildUrl(page, status, query);
  const requestKey = `${url}#${reloadKey}`;

  // Debounced server-side search.
  useEffect(() => {
    const t = setTimeout(() => {
      const q = search.trim();
      if (q !== query) {
        setQuery(q);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, query]);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setResult((prev) => ({
          key: requestKey,
          data: res.ok ? data : prev?.data ?? null,
          error: res.ok ? '' : data.error || 'Failed to load pages',
          fetchedAt: Date.now(),
        }));
      })
      .catch((e) => {
        if (cancelled) return;
        setResult((prev) => ({ key: requestKey, data: prev?.data ?? null, error: e.message, fetchedAt: Date.now() }));
      });
    return () => {
      cancelled = true;
    };
  }, [url, requestKey]);

  const loading = !result || result.key !== requestKey;
  const data = result?.data;
  const posts = data?.posts ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;
  const counts = {
    publishedCount: data?.publishedCount ?? 0,
    draftCount: data?.draftCount ?? 0,
    scheduledCount: data?.scheduledCount ?? 0,
  };
  const allCount = counts.publishedCount + counts.draftCount + counts.scheduledCount;
  const fetchedAt = result?.fetchedAt ?? 0;

  const applyFilter = (value) => {
    setStatus(value);
    setPage(1);
  };

  const isLive = (post) =>
    post.status === 'published' ||
    (post.status === 'scheduled' && post.scheduled_at && new Date(post.scheduled_at).getTime() <= fetchedAt);

  const handleDelete = async (post) => {
    const ok = await showConfirm(
      'Delete page',
      `"${post.title}" will be permanently deleted. This cannot be undone.`,
      'danger'
    );
    if (!ok) return;
    setDeleting(post.id);
    try {
      const res = await fetch('/api/admin/posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to delete');
      toast.success('Page deleted');
      if (posts.length === 1 && page > 1) setPage(page - 1);
      else setReloadKey((k) => k + 1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <PageHeader
        icon={FileText}
        title="Pages"
        description="Articles and standalone pages, served at famies.app/<slug>."
        actions={
          <>
            <ClearCacheButton />
            <Link
              href="/admin/pages/new"
              className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 text-[13px] font-semibold text-white shadow-pink transition-colors hover:bg-primary-500"
            >
              <Plus className="w-4 h-4" />
              New page
            </Link>
          </>
        }
      />

      {/* Status tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((tab) => {
          const active = status === tab.value;
          const count = tab.countKey ? counts[tab.countKey] : allCount;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => applyFilter(tab.value)}
              title={tab.title}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-colors',
                active
                  ? 'border-ink-900 bg-ink-900 text-white'
                  : 'border-ink-100 bg-white text-ink-500 hover:border-ink-200 hover:text-ink-900'
              )}
            >
              {tab.dot && <span className={cn('h-1.5 w-1.5 rounded-full', tab.dot)} />}
              {tab.label}
              <span className={cn('font-semibold', active ? 'text-white/70' : 'text-ink-300')}>{data ? count : '…'}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
        <input
          type="text"
          placeholder="Search by title or slug…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 w-full rounded-xl border border-ink-100 bg-white pl-11 pr-10 text-sm text-ink-900 outline-none transition placeholder:text-ink-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-300 hover:bg-ink-50 hover:text-ink-900"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {result?.error && (
        <Notice tone="error" className="mb-4">
          {result.error}
        </Notice>
      )}

      <Card bodyClassName="p-0">
        {loading && !data ? (
          <TableSkeleton />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={query ? 'No pages match your search' : status === 'all' ? 'No pages yet' : `No ${status} pages`}
            text={query ? `Nothing found for “${query}”.` : 'Articles you create (or publish from Writerfy) show up here.'}
            action={
              <Link href="/admin/pages/new" className="text-[13px] font-bold text-primary-700 hover:underline">
                Create a page →
              </Link>
            }
          />
        ) : (
          <div className={cn('overflow-x-auto transition-opacity', loading && 'opacity-60')}>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-ink-100 text-left text-[10px] font-bold uppercase tracking-wider text-ink-300">
                  <th className="px-5 py-3.5">Title</th>
                  <th className="hidden px-4 py-3.5 md:table-cell">Category</th>
                  <th className="hidden px-4 py-3.5 lg:table-cell">Status</th>
                  <th className="hidden px-4 py-3.5 md:table-cell">Date</th>
                  <th className="hidden px-4 py-3.5 md:table-cell">Views</th>
                  <th className="hidden px-4 py-3.5 md:table-cell">Links</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {posts.map((post) => {
                  const live = isLive(post);
                  return (
                    <tr key={post.id} className="transition-colors hover:bg-ink-50/60">
                      <td className="max-w-[340px] px-5 py-3.5">
                        <Link
                          href={`/admin/pages/edit?id=${post.id}`}
                          className="block truncate font-semibold text-ink-900 hover:text-primary-700"
                        >
                          {post.title || 'Untitled'}
                        </Link>
                        <p className="truncate text-[11px] text-ink-300">{post.slug}</p>
                        <span className="lg:hidden">
                          <Badge tone={STATUS_TONES[post.status] || 'gray'} className="mt-1">
                            {post.status}
                          </Badge>
                        </span>
                        {post.status === 'scheduled' && post.scheduled_at && (
                          <p className="mt-1 inline-flex items-center gap-1 rounded-md border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                            <CalendarClock className="w-3 h-3" />
                            {live ? 'Went live' : 'Publishes'} {formatDate(post.scheduled_at, true)}
                          </p>
                        )}
                      </td>
                      <td className="hidden px-4 py-3.5 md:table-cell">
                        <span className="text-[12px] text-ink-500">{post.category || '—'}</span>
                      </td>
                      <td className="hidden px-4 py-3.5 lg:table-cell">
                        <Badge tone={STATUS_TONES[post.status] || 'gray'}>{post.status}</Badge>
                      </td>
                      <td className="hidden px-4 py-3.5 md:table-cell">
                        <span className="whitespace-nowrap text-[12px] text-ink-500" title={post.published_at ? 'Published' : 'Created'}>
                          {formatDate(post.published_at || post.created_at)}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3.5 md:table-cell">
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-500">
                          <Eye className="w-3.5 h-3.5 text-ink-300" />
                          {(post.views ?? 0).toLocaleString('en-US')}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3.5 md:table-cell">
                        <LinksBadge count={post.internal_links ?? 0} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-0.5">
                          {live ? (
                            <a
                              href={absoluteUrl(post.slug)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={iconBtn}
                              title="View live page"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          ) : (
                            <span className="cursor-not-allowed p-2 text-ink-200" title="Not live yet">
                              <ExternalLink className="w-4 h-4" />
                            </span>
                          )}
                          <Link href={`/admin/pages/edit?id=${post.id}`} className={iconBtn} title="Edit">
                            <Pencil className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(post)}
                            disabled={deleting === post.id}
                            className="rounded-lg p-2 text-ink-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                            title="Delete"
                          >
                            {deleting === post.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] font-medium text-ink-500">
            Page {page} of {totalPages} ({total.toLocaleString('en-US')} pages)
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
              className="rounded-lg border border-ink-100 bg-white px-2.5 py-1.5 text-ink-500 transition-colors hover:text-ink-900 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {pageWindow(page, totalPages).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                aria-current={p === page ? 'page' : undefined}
                className={cn(
                  'min-w-[34px] rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors',
                  p === page
                    ? 'border-primary bg-primary text-white shadow-pink'
                    : 'border-ink-100 bg-white text-ink-500 hover:text-ink-900'
                )}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              aria-label="Next page"
              className="rounded-lg border border-ink-100 bg-white px-2.5 py-1.5 text-ink-500 transition-colors hover:text-ink-900 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
