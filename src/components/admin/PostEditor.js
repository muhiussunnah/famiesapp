'use client';
/**
 * Article / page editor shared by /admin/pages/new and /admin/pages/edit.
 *
 *   <PostEditor />              → create (POST /api/admin/posts)
 *   <PostEditor postId="12" />  → edit   (PATCH /api/admin/posts)
 *
 * Ctrl/Cmd+S saves. Leaving with unsaved changes asks first (in-app links
 * via a confirm modal, tab close / reload via the browser prompt).
 */
import { useDeferredValue, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Save, Send, Trash2, ExternalLink, Image as ImageIcon, Upload, Search,
  Code2, Braces, CalendarClock, PanelRight, Square, UserRound, Tag, FileText,
  CheckCircle2, AlertCircle, RefreshCw, Wand2, Keyboard, Eye,
} from 'lucide-react';
import { PageHeader, Card, Button, Field, Input, Textarea, Select, Badge, Notice, LoadingBlock } from '@/components/admin/ui';
import { useModal } from '@/components/admin/AdminModal';
import {
  SITE_URL, CATEGORIES, DEFAULT_CATEGORY, DEFAULT_AUTHOR_NAME, DEFAULT_AUTHOR_ROLE, absoluteUrl,
} from '@/lib/site';
import { slugify, normalizeSlug, autoExcerpt, extractFirstImage, truncate } from '@/lib/content-helpers';
import { cn } from '@/lib/utils';

const RichEditor = dynamic(() => import('@/components/admin/RichEditor'), {
  ssr: false,
  loading: () => <LoadingBlock label="Loading editor…" className="rounded-2xl border border-ink-100 bg-white" />,
});
const InterlinkChecker = dynamic(() => import('@/components/admin/InterlinkChecker'), { ssr: false });

const META_TITLE_MAX = 60;
const META_DESC_MAX = 155;
const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', hint: 'Only visible here in the admin.' },
  { value: 'published', label: 'Published', hint: `Live on ${SITE_HOST}.` },
  { value: 'scheduled', label: 'Scheduled', hint: 'Goes live automatically at the chosen time.' },
];

const LAYOUT_OPTIONS = [
  { value: 'with-sidebar', label: 'With sidebar', icon: PanelRight },
  { value: 'full-page', label: 'Full page', icon: Square },
];

const EMPTY_FORM = {
  title: '',
  slug: '',
  category: DEFAULT_CATEGORY,
  featured_image: '',
  status: 'draft',
  scheduled_at: '',
  author_name: DEFAULT_AUTHOR_NAME,
  author_role: DEFAULT_AUTHOR_ROLE,
  meta_title: '',
  meta_description: '',
  excerpt: '',
  layout: 'with-sidebar',
  custom_css: '',
  custom_schema: '',
};

const SCHEMA_PLACEHOLDER = `{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Är det gratis för barn?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Ja, barn under 7 år går in gratis."
      }
    }
  ]
}`;

// ── helpers ───────────────────────────────────────────────────

/** ISO timestamp → value for <input type="datetime-local"> (local time). */
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Serialise HTML the way the contentEditable will, so loading a post and
 * touching nothing never counts as an edit. Parsed in an inert document
 * (no image loads, no event handlers run).
 */
function normalizeHtml(html) {
  if (!html || typeof document === 'undefined') return html || '';
  const doc = document.implementation.createHTMLDocument('');
  const div = doc.createElement('div');
  div.innerHTML = html;
  return div.innerHTML;
}

function formFromPost(post) {
  return {
    title: post.title || '',
    slug: (post.slug || '').replace(/^\/+/, ''),
    category: post.category || DEFAULT_CATEGORY,
    featured_image: post.featured_image || '',
    status: post.status || 'draft',
    scheduled_at: toLocalInput(post.scheduled_at),
    author_name: post.author_name || '',
    author_role: post.author_role || '',
    meta_title: post.meta_title || '',
    meta_description: post.meta_description || '',
    // Auto-generated excerpts show as empty (= keep auto-generating).
    excerpt: post.excerpt && post.excerpt !== autoExcerpt(post.content || '') ? post.excerpt : '',
    layout: post.layout || 'with-sidebar',
    custom_css: post.custom_css || '',
    custom_schema: post.custom_schema || '',
  };
}

/** Comparable fingerprint of the form (for the unsaved-changes check). */
function snapshot(form) {
  return JSON.stringify({
    ...form,
    slug: normalizeSlug(form.slug),
    featured_image: form.featured_image.trim(),
    scheduled_at: form.status === 'scheduled' ? form.scheduled_at : '',
  });
}

function CharCounter({ length, max, warnAt }) {
  return (
    <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
      <span className={length > max ? 'text-red-500' : length > warnAt ? 'text-amber-600' : 'text-ink-300'}>
        {length}/{max} characters
      </span>
      {length > 0 && length <= max && (
        <span className="flex items-center gap-1 text-emerald-600">
          <CheckCircle2 className="w-3 h-3" /> Good length
        </span>
      )}
      {length > max && (
        <span className="flex items-center gap-1 text-red-500">
          <AlertCircle className="w-3 h-3" /> Too long — Google will truncate
        </span>
      )}
    </div>
  );
}

function Segmented({ options, value, onChange, className }) {
  return (
    <div className={cn('grid gap-2', className)}>
      {options.map((o) => {
        const active = value === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[13px] font-semibold transition-colors',
              active
                ? 'border-primary/40 bg-primary/10 text-primary-700'
                : 'border-ink-100 bg-white text-ink-500 hover:border-ink-200 hover:text-ink-900'
            )}
          >
            {Icon && <Icon className="w-4 h-4" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const linkButton =
  'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-ink-100 bg-white px-4 text-[13px] font-semibold text-ink-700 transition-colors hover:border-ink-200 hover:bg-ink-50';

// ── component ─────────────────────────────────────────────────

export default function PostEditor({ postId = null }) {
  const isNew = !postId;
  const router = useRouter();
  const { showConfirm } = useModal();
  const featuredFileRef = useRef(null);
  const saveRef = useRef(null);
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);

  const [loadState, setLoadState] = useState(isNew ? 'ready' : 'loading');
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [content, setContent] = useState('');
  const [baseline, setBaseline] = useState(() => ({ snap: snapshot(EMPTY_FORM), content: '' }));
  const [saved, setSaved] = useState(null); // last saved row from the server
  const [autoSlug, setAutoSlug] = useState(isNew);
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [saving, setSaving] = useState(null); // null | 'save' | 'publish'
  const [deleting, setDeleting] = useState(false);
  const [uploadingFeatured, setUploadingFeatured] = useState(false);
  const [error, setError] = useState('');
  const [schemaError, setSchemaError] = useState('');
  const [scheduleError, setScheduleError] = useState('');

  const deferredContent = useDeferredValue(content);
  const dirty = loadState === 'ready' && (snapshot(form) !== baseline.snap || content !== baseline.content);

  // ── load (edit mode) ──
  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    fetch(`/api/admin/posts?id=${encodeURIComponent(postId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to load post');
        return data;
      })
      .then((post) => {
        if (cancelled) return;
        const f = formFromPost(post);
        const html = normalizeHtml(post.content || '');
        setForm(f);
        setContent(html);
        setBaseline({ snap: snapshot(f), content: html });
        setSaved(post);
        setLoadState('ready');
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e.message);
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [isNew, postId]);

  // ── keyboard + leave guards ──
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    saveRef.current = handleSave;
  });

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key?.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Tab close / reload / external navigation.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // In-app links (sidebar, back link, …): intercept before Next's <Link>.
  useEffect(() => {
    const onClick = (e) => {
      if (!dirtyRef.current) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.('a[href]');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      if (a.closest('[contenteditable="true"]')) return; // links inside the article body
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return; // full page load → beforeunload handles it
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      showConfirm(
        'Leave without saving?',
        'You have unsaved changes on this page. They will be lost if you leave now.',
        'warning',
        { confirmText: 'Leave page' }
      ).then((ok) => {
        if (!ok) return;
        dirtyRef.current = false;
        router.push(url.pathname + url.search + url.hash);
      });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router, showConfirm]);

  // ── field handlers ──

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleTitleChange = (value) => {
    setForm((f) => ({ ...f, title: value, slug: autoSlug ? slugify(value) : f.slug }));
  };

  const handleSlugChange = (value) => {
    setAutoSlug(false);
    set('slug', value);
  };

  const tidySlug = () => {
    if (form.slug.trim()) set('slug', normalizeSlug(form.slug).replace(/^\/+/, ''));
  };

  const regenerateSlug = () => {
    setAutoSlug(true);
    set('slug', slugify(form.title));
  };

  const handleStatusChange = (value) => {
    setScheduleError('');
    // Suggest tomorrow 09:00 when scheduling for the first time.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const suggested = toLocalInput(tomorrow.toISOString());
    setForm((f) => ({
      ...f,
      status: value,
      scheduled_at: value === 'scheduled' && !f.scheduled_at ? suggested : f.scheduled_at,
    }));
  };

  const handleScheduleChange = (value) => {
    set('scheduled_at', value);
    const d = new Date(value);
    setScheduleError(value && !Number.isNaN(d.getTime()) && d.getTime() <= Date.now() ? 'Pick a time in the future.' : '');
  };

  const handleContentChange = (html) => setContent(html);

  // Content changed outside the editor (Interlink Checker) → re-seed it.
  const handleInterlinksApplied = (html) => {
    setContent(html);
    setEditorResetKey((k) => k + 1);
  };

  const handleFeaturedUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFeatured(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      if (res.status === 413) throw new Error('File too large (max 8 MB).');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      set('featured_image', data.url);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingFeatured(false);
      if (featuredFileRef.current) featuredFileRef.current.value = '';
    }
  };

  const validateSchema = () => {
    const raw = form.custom_schema.trim();
    if (!raw) {
      setSchemaError('');
      return true;
    }
    try {
      JSON.parse(raw);
      setSchemaError('');
      return true;
    } catch (e) {
      setSchemaError(e.message);
      return false;
    }
  };

  const formatSchema = () => {
    try {
      set('custom_schema', JSON.stringify(JSON.parse(form.custom_schema), null, 2));
      setSchemaError('');
    } catch (e) {
      setSchemaError(e.message);
    }
  };

  // ── save ──

  async function handleSave(overrideStatus) {
    if (loadState !== 'ready' || savingRef.current) return;
    const fail = (msg) => {
      setError(msg);
      toast.error(msg);
    };

    const status = overrideStatus || form.status;
    const title = form.title.trim();
    if (!title) return fail('Title is required.');

    let slug = normalizeSlug(form.slug || title);
    if (!slug) return fail('Slug is required.');
    // Untouched slug → send the stored value verbatim so a legacy slug
    // (uppercase, nested, …) is never rewritten behind the user's back.
    if (saved?.slug && normalizeSlug(saved.slug) === slug) slug = saved.slug;

    let scheduledAt = null;
    if (status === 'scheduled') {
      const d = form.scheduled_at ? new Date(form.scheduled_at) : null;
      if (!d || Number.isNaN(d.getTime())) return fail('Pick a date and time for the scheduled post.');
      if (d.getTime() <= Date.now()) {
        setScheduleError('Pick a time in the future.');
        return fail('The scheduled time must be in the future.');
      }
      scheduledAt = d.toISOString();
    }

    const schemaRaw = form.custom_schema.trim();
    if (schemaRaw) {
      try {
        JSON.parse(schemaRaw);
      } catch (e) {
        setSchemaError(e.message);
        return fail(`Custom schema contains invalid JSON: ${e.message}`);
      }
    }
    setSchemaError('');
    setError('');

    const sentForm = form;
    const sentContent = content;
    const payload = {
      title,
      slug,
      content: sentContent,
      featured_image: form.featured_image.trim(),
      category: form.category,
      status,
      scheduled_at: scheduledAt,
      author_name: form.author_name.trim(),
      author_role: form.author_role.trim(),
      meta_title: form.meta_title.trim(),
      meta_description: form.meta_description.trim(),
      excerpt: form.excerpt.trim(),
      layout: form.layout,
      custom_css: form.custom_css.trim() || null,
      custom_schema: schemaRaw || null,
    };
    if (!isNew) payload.id = Number(postId);

    savingRef.current = true;
    setSaving(overrideStatus === 'published' ? 'publish' : 'save');
    try {
      const res = await fetch('/api/admin/posts', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      const serverForm = formFromPost(data);
      setSaved(data);
      setBaseline({ snap: snapshot(serverForm), content: sentContent });
      // Adopt the server's normalised values unless the user kept typing.
      setForm((cur) => (cur === sentForm ? serverForm : cur));
      setAutoSlug(false);

      const msg =
        data.status === 'published'
          ? saved?.status === 'published'
            ? 'Changes saved'
            : `Published — live on ${SITE_HOST}`
          : data.status === 'scheduled'
            ? `Scheduled for ${formatDateTime(data.scheduled_at)}`
            : 'Draft saved';
      toast.success(msg);

      if (isNew) {
        dirtyRef.current = false;
        router.replace(`/admin/pages/edit?id=${data.id}`);
      }
    } catch (err) {
      fail(err.message);
    } finally {
      savingRef.current = false;
      setSaving(null);
    }
  }

  async function handleDelete() {
    const ok = await showConfirm(
      'Delete page',
      `"${form.title || 'Untitled'}" will be permanently deleted. This cannot be undone.`,
      'danger'
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(postId) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      toast.success('Page deleted');
      dirtyRef.current = false;
      router.push('/admin/pages');
    } catch (err) {
      toast.error(err.message);
      setDeleting(false);
    }
  }

  // ── render ──

  if (loadState === 'loading') return <LoadingBlock label="Loading page…" />;

  if (loadState === 'error') {
    return (
      <div className="space-y-4">
        <Link href="/admin/pages" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-500 hover:text-ink-900">
          <ArrowLeft className="w-4 h-4" /> All pages
        </Link>
        <Notice tone="error" title="Could not load this page">
          {loadError}
        </Notice>
      </div>
    );
  }

  const slugPath = normalizeSlug(form.slug || form.title);
  const publicUrl = slugPath ? absoluteUrl(slugPath) : '';
  const autoImage = form.featured_image.trim() ? null : extractFirstImage(deferredContent);
  const previewImage = form.featured_image.trim() || autoImage;
  const categoryOptions = CATEGORIES.includes(form.category) ? CATEGORIES : [form.category, ...CATEGORIES];
  const savedIsLive = saved?.status === 'published';

  const previewTitle = truncate(form.meta_title.trim() || form.title.trim() || 'Untitled page', META_TITLE_MAX);
  const previewDesc = truncate(
    form.meta_description.trim() || form.excerpt.trim() || autoExcerpt(deferredContent) || 'No description set.',
    META_DESC_MAX
  );

  const primaryLabel =
    form.status === 'scheduled'
      ? 'Schedule'
      : form.status === 'published'
        ? savedIsLive
          ? 'Update'
          : 'Publish'
        : 'Save draft';

  const busy = !!saving || deleting;

  return (
    <div>
      <Link href="/admin/pages" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft className="w-4 h-4" /> All pages
      </Link>

      <PageHeader
        icon={FileText}
        title={isNew ? 'New page' : 'Edit page'}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {isNew ? (
              <span>Create a new article or page.</span>
            ) : (
              <span>
                ID {postId}
                {saved?.updated_at && <> · Last saved {formatDateTime(saved.updated_at)}</>}
                {typeof saved?.views === 'number' && <> · {saved.views.toLocaleString('en-US')} views</>}
              </span>
            )}
            {dirty ? <Badge tone="amber">Unsaved changes</Badge> : !isNew && <Badge tone="green">Saved</Badge>}
            <span className="hidden items-center gap-1 text-[11px] text-ink-300 sm:inline-flex">
              <Keyboard className="w-3 h-3" /> Ctrl/⌘ + S to save
            </span>
          </span>
        }
        actions={
          <>
            {!isNew && (
              <Button variant="danger" icon={Trash2} onClick={handleDelete} loading={deleting} disabled={busy}>
                Delete
              </Button>
            )}
            {savedIsLive && saved?.slug && (
              <a href={absoluteUrl(saved.slug)} target="_blank" rel="noopener noreferrer" className={linkButton}>
                <ExternalLink className="w-4 h-4" /> View live
              </a>
            )}
            {form.status === 'draft' ? (
              <>
                <Button variant="secondary" icon={Save} onClick={() => handleSave()} loading={saving === 'save'} disabled={busy}>
                  Save draft
                </Button>
                <Button variant="accent" icon={Send} onClick={() => handleSave('published')} loading={saving === 'publish'} disabled={busy}>
                  Publish
                </Button>
              </>
            ) : (
              <Button
                variant="accent"
                icon={form.status === 'scheduled' ? CalendarClock : savedIsLive ? Save : Send}
                onClick={() => handleSave()}
                loading={!!saving}
                disabled={busy}
              >
                {primaryLabel}
              </Button>
            )}
          </>
        }
      />

      {error && (
        <Notice tone="error" className="mb-5">
          {error}
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Main column ── */}
        <div className="space-y-5 lg:col-span-2 min-w-0">
          <Card>
            <div className="space-y-5">
              <Field label="Title" htmlFor="post-title">
                <Input
                  id="post-title"
                  value={form.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Enter the article title…"
                  className="h-12 text-lg font-bold"
                />
              </Field>

              <Field
                label="Permalink"
                htmlFor="post-slug"
                hint={autoSlug ? 'Generated from the title until you edit it.' : 'Lowercase letters, numbers and dashes.'}
              >
                <div className="flex items-stretch gap-2">
                  <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-xl border border-ink-100 bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                    <span className="flex items-center border-r border-ink-100 bg-ink-50 px-3 text-sm text-ink-500 whitespace-nowrap">
                      {SITE_HOST}/
                    </span>
                    <input
                      id="post-slug"
                      value={form.slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      onBlur={tidySlug}
                      placeholder="my-article"
                      className="h-10 min-w-0 flex-1 px-3 text-sm text-ink-900 outline-none placeholder:text-ink-300"
                    />
                  </div>
                  {!autoSlug && (
                    <Button variant="secondary" icon={RefreshCw} onClick={regenerateSlug} title="Regenerate the slug from the title">
                      <span className="hidden sm:inline">From title</span>
                    </Button>
                  )}
                </div>
                {publicUrl && (
                  <p className="mt-1.5 truncate text-[12px] text-ink-500">
                    Public URL:{' '}
                    {savedIsLive && saved?.slug && normalizeSlug(saved.slug) === slugPath ? (
                      <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-700 hover:underline">
                        {publicUrl}
                      </a>
                    ) : (
                      <span className="font-semibold text-ink-700">{publicUrl}</span>
                    )}
                  </p>
                )}
                {!isNew && savedIsLive && saved?.slug && slugPath && normalizeSlug(saved.slug) !== slugPath && (
                  <Notice tone="warning" className="mt-2">
                    Changing the slug of a live page breaks existing links to {saved.slug}. Consider a redirect.
                  </Notice>
                )}
              </Field>
            </div>
          </Card>

          <Card
            title="Featured image"
            description="Used on article cards and social shares. Recommended 1200×630 px (1.91:1) · JPG / PNG / WebP."
          >
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
                <Input
                  value={form.featured_image}
                  onChange={(e) => set('featured_image', e.target.value)}
                  placeholder="https://… (empty = first image in the content)"
                  className="pl-9"
                />
              </div>
              <Button
                variant="secondary"
                icon={Upload}
                loading={uploadingFeatured}
                onClick={() => featuredFileRef.current?.click()}
              >
                Upload
              </Button>
              <input ref={featuredFileRef} type="file" accept={IMAGE_ACCEPT} onChange={handleFeaturedUpload} className="hidden" />
            </div>
            {previewImage ? (
              <div className="relative mt-3 overflow-hidden rounded-xl border border-ink-100 bg-ink-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewImage} alt="Featured image preview" className="h-56 w-full object-cover" />
                {autoImage && (
                  <span className="absolute left-3 top-3">
                    <Badge tone="blue">Auto: first image in the content</Badge>
                  </span>
                )}
                {form.featured_image.trim() && (
                  <button
                    type="button"
                    onClick={() => set('featured_image', '')}
                    className="absolute right-3 top-3 rounded-lg bg-white/90 px-2 py-1 text-[11px] font-bold text-ink-700 shadow-sm hover:bg-white"
                  >
                    Remove
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-ink-300">No image yet — add one or insert an image in the content.</p>
            )}
          </Card>

          <div>
            <p className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-ink-500">Content</p>
            <RichEditor value={content} onChange={handleContentChange} resetKey={editorResetKey} />
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-5 min-w-0">
          <Card title="Publish" description={STATUS_OPTIONS.find((o) => o.value === form.status)?.hint}>
            <Segmented options={STATUS_OPTIONS} value={form.status} onChange={handleStatusChange} className="grid-cols-3" />
            {form.status === 'scheduled' && (
              <Field label="Publish at" htmlFor="post-scheduled" className="mt-4" hint="Your local time.">
                <Input
                  id="post-scheduled"
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => handleScheduleChange(e.target.value)}
                />
                {scheduleError && <p className="text-[12px] font-semibold text-red-500">{scheduleError}</p>}
              </Field>
            )}
            {saved && (
              <div className="mt-4 space-y-1 border-t border-ink-100 pt-3 text-[12px] text-ink-500">
                <p className="flex items-center justify-between gap-2">
                  <span>Saved status</span>
                  <Badge tone={saved.status === 'published' ? 'green' : saved.status === 'scheduled' ? 'blue' : 'amber'}>
                    {saved.status}
                  </Badge>
                </p>
                {saved.published_at && <p>Published {formatDateTime(saved.published_at)}</p>}
                {saved.status === 'scheduled' && saved.scheduled_at && <p>Goes live {formatDateTime(saved.scheduled_at)}</p>}
              </div>
            )}
          </Card>

          <Card title="Category">
            <div className="relative">
              <Select value={form.category} onChange={(e) => set('category', e.target.value)} aria-label="Category">
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Tag className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
            </div>
          </Card>

          <Card title="Layout" description="Article with the sidebar, or a full-width page.">
            <Segmented options={LAYOUT_OPTIONS} value={form.layout} onChange={(v) => set('layout', v)} className="grid-cols-2" />
          </Card>

          <InterlinkChecker content={content} currentSlug={slugPath} onContentChange={handleInterlinksApplied} />

          <Card
            title="SEO"
            actions={<Search className="w-4 h-4 text-primary-700" />}
            bodyClassName="space-y-4"
          >
            <Field label="Meta title" htmlFor="post-meta-title">
              <Input
                id="post-meta-title"
                value={form.meta_title}
                onChange={(e) => set('meta_title', e.target.value)}
                placeholder={form.title || 'Title for search engines…'}
              />
              <CharCounter length={form.meta_title.length} max={META_TITLE_MAX} warnAt={50} />
            </Field>

            <Field label="Meta description" htmlFor="post-meta-desc">
              <Textarea
                id="post-meta-desc"
                value={form.meta_description}
                onChange={(e) => set('meta_description', e.target.value)}
                placeholder="Short summary for Google results (max 155 characters)…"
                rows={3}
                className="min-h-[84px] resize-none"
              />
              <CharCounter length={form.meta_description.length} max={META_DESC_MAX} warnAt={140} />
            </Field>

            <Field label="Excerpt" htmlFor="post-excerpt" hint="Shown on article cards. Leave empty to generate it from the content.">
              <Textarea
                id="post-excerpt"
                value={form.excerpt}
                onChange={(e) => set('excerpt', e.target.value)}
                placeholder={autoExcerpt(deferredContent) || 'Generated from the content…'}
                rows={3}
                className="min-h-[84px] resize-y"
              />
            </Field>

            <div className="rounded-xl border border-ink-100 bg-white p-3.5">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-300">
                <Eye className="w-3 h-3" /> Google preview
              </p>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink-100 bg-primary-50 text-[11px] font-black text-primary-700">
                  F
                </div>
                <div className="min-w-0 leading-tight">
                  <p className="text-[13px] text-[#202124]">Famies</p>
                  <p className="truncate text-[11px] text-[#4d5156]">
                    {SITE_HOST}
                    {slugPath ? ` › ${slugPath.replace(/^\//, '')}` : ''}
                  </p>
                </div>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[17px] leading-snug text-[#1a0dab]">{previewTitle}</p>
              <p className="mt-0.5 line-clamp-3 text-[13px] leading-snug text-[#4d5156]">{previewDesc}</p>
            </div>
          </Card>

          <Card title="Author" actions={<UserRound className="w-4 h-4 text-ink-300" />} bodyClassName="space-y-3">
            <Field label="Name" htmlFor="post-author-name">
              <Input
                id="post-author-name"
                value={form.author_name}
                onChange={(e) => set('author_name', e.target.value)}
                placeholder={DEFAULT_AUTHOR_NAME}
              />
            </Field>
            <Field label="Role" htmlFor="post-author-role">
              <Input
                id="post-author-role"
                value={form.author_role}
                onChange={(e) => set('author_role', e.target.value)}
                placeholder={DEFAULT_AUTHOR_ROLE}
              />
            </Field>
          </Card>

          <Card
            title="Custom CSS"
            description="Only loads on this page, after the global CSS, so these rules win."
            actions={<Code2 className="w-4 h-4 text-primary-700" />}
          >
            <Textarea
              mono
              value={form.custom_css}
              onChange={(e) => set('custom_css', e.target.value)}
              placeholder={'/* Example */\nh2 {\n  color: #c73d67;\n}'}
              rows={8}
              spellCheck={false}
              className="resize-y text-[12px]"
              style={{ tabSize: 2 }}
            />
            {form.custom_css.trim() && (
              <p className="mt-1.5 text-[11px] text-emerald-600">{form.custom_css.length} characters — injected on save</p>
            )}
          </Card>

          <Card
            title="Custom schema (JSON-LD)"
            description="Only loads on this page. When set it replaces the default Article schema — use it for FAQPage, HowTo, Event, etc."
            actions={<Braces className="w-4 h-4 text-primary-700" />}
          >
            <Textarea
              mono
              value={form.custom_schema}
              onChange={(e) => {
                set('custom_schema', e.target.value);
                if (schemaError) setSchemaError('');
              }}
              onBlur={validateSchema}
              placeholder={SCHEMA_PLACEHOLDER}
              rows={10}
              spellCheck={false}
              className={cn('resize-y text-[12px]', schemaError && 'border-red-300 focus:border-red-400 focus:ring-red-100')}
              style={{ tabSize: 2 }}
            />
            <div className="mt-1.5 flex items-center justify-between gap-2">
              {schemaError ? (
                <p className="text-[11px] font-semibold text-red-500">Invalid JSON: {schemaError}</p>
              ) : form.custom_schema.trim() ? (
                <p className="text-[11px] text-emerald-600">Valid JSON — replaces the default schema on save</p>
              ) : (
                <span />
              )}
              {form.custom_schema.trim() && (
                <Button variant="ghost" size="sm" icon={Wand2} onClick={formatSchema}>
                  Format
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
