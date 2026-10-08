'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Palette, Type, Share2, Award, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Save, X, Upload, RotateCcw, Mail,
} from 'lucide-react';
import {
  PageHeader, Card, Button, Field, Input, Textarea, Select, Toggle, Badge, Notice, EmptyState, LoadingBlock,
} from '@/components/admin/ui';
import { useModal } from '@/components/admin/AdminModal';
import { cn } from '@/lib/utils';

/* ─── config ────────────────────────────────────────────────────────── */

const TABS = [
  { id: 'texts', label: 'Texts & links', icon: Type },
  { id: 'social', label: 'Social links', icon: Share2 },
  { id: 'badges', label: 'Footer badges', icon: Award },
];

// site_settings keys edited here (groups brand / columns / bottom).
const SETTING_GROUPS = [
  {
    id: 'brand',
    title: 'Brand & contact',
    description: 'Text under the Famies logo, the support email and the app store links.',
    fields: [
      { key: 'footer_description', label: 'Footer description', type: 'textarea', hint: 'Short text under the logo.' },
      { key: 'contact_email', label: 'Contact email', type: 'email', hint: 'Shown in the Support column.' },
      { key: 'app_store_url', label: 'App Store URL', type: 'url' },
      { key: 'google_play_url', label: 'Google Play URL', type: 'url' },
    ],
  },
  {
    id: 'columns',
    title: 'Columns',
    description: 'Footer column headings and the app column text. The links themselves are managed under Menus.',
    fields: [
      { key: 'footer_explore_heading', label: 'First link column heading', placeholder: 'Utforska' },
      { key: 'footer_company_heading', label: 'Second link column heading', placeholder: 'Support' },
      { key: 'footer_app_heading', label: 'App column heading', placeholder: 'Hämta appen' },
      { key: 'footer_app_text', label: 'App column text' },
    ],
  },
  {
    id: 'bottom',
    title: 'Bottom bar',
    description: 'The line at the very bottom of every page.',
    fields: [
      { key: 'copyright_text', label: 'Copyright text', hint: '{year} is replaced with the current year.' },
      { key: 'footer_tagline', label: 'Bottom-right tagline' },
    ],
  },
];
const KNOWN_KEYS = new Set(SETTING_GROUPS.flatMap((g) => g.fields.map((f) => f.key)));

const BADGE_LOCATIONS = [
  { id: 'footer_explore', label: 'Under the Utforska column' },
  { id: 'footer_company', label: 'Under the Support column' },
];

const svgIcon = (d) => `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="${d}"/></svg>`;

// Brand icon paths (same as the db/schema.sql seed).
const SOCIAL_PRESETS = [
  {
    label: 'Instagram',
    brand: '#E1306C',
    href: 'https://www.instagram.com/famies.app/',
    placeholder: 'https://www.instagram.com/…',
    d: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z',
  },
  {
    label: 'TikTok',
    brand: '#000000',
    href: 'https://www.tiktok.com/@famies.app',
    placeholder: 'https://www.tiktok.com/@…',
    d: 'M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z',
  },
  {
    label: 'YouTube',
    brand: '#FF0000',
    href: 'https://www.youtube.com/@TheFamies',
    placeholder: 'https://www.youtube.com/@…',
    d: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  },
  {
    label: 'Facebook',
    brand: '#1877F2',
    href: '',
    placeholder: 'https://www.facebook.com/…',
    d: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  },
  {
    label: 'LinkedIn',
    brand: '#0A66C2',
    href: '',
    placeholder: 'https://www.linkedin.com/company/…',
    d: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  },
  {
    label: 'X',
    brand: '#000000',
    href: '',
    placeholder: 'https://x.com/…',
    d: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
  {
    label: 'Pinterest',
    brand: '#E60023',
    href: '',
    placeholder: 'https://www.pinterest.com/…',
    d: 'M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z',
  },
];

const COLOR_SWATCHES = [
  { label: 'Neutral', bg: '#f3f4f6', icon: '#4b5563' },
  { label: 'Famies pink', bg: '#FF8FAF', icon: '#ffffff' },
  { label: 'Mint', bg: '#CCFAD6', icon: '#1c4c2b' },
  { label: 'Dark', bg: '#0c0a13', icon: '#ffffff' },
];

const EMPTY_SOCIAL = { label: '', href: '', icon_svg: '', bg_color: '#f3f4f6', icon_color: '#4b5563', enabled: true };
const EMPTY_BADGE = { location: 'footer_explore', image_url: '', link_url: '', alt_text: '', width: 120, height: '', enabled: true };

/* ─── helpers ───────────────────────────────────────────────────────── */

async function api(url, options = {}) {
  const res = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

/** Strip scripts / handlers before showing admin-typed SVG (the API sanitises on save too). */
function previewSvg(svg) {
  return String(svg || '')
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<\/?(iframe|object|embed|foreignObject)[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');
}

const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v || '');
const bySort = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0);

/* ─── page ──────────────────────────────────────────────────────────── */

export default function FooterSettingsPage() {
  const [tab, setTab] = useState('texts');

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Palette}
        title="Footer Content"
        description="Texts, store links, social icons and partner badges in the site footer. Footer links are managed under Menus."
        actions={
          <Link
            href="/admin/menus"
            className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[13px] font-semibold rounded-xl bg-white text-ink-700 border border-ink-100 hover:border-ink-200 hover:bg-ink-50 transition-colors"
          >
            Edit footer links
          </Link>
        }
      />

      <div className="flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-white border border-ink-100">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-colors',
              tab === id ? 'bg-primary/15 text-primary-700' : 'text-ink-500 hover:text-ink-900 hover:bg-ink-50'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'texts' && <TextsTab />}
      {tab === 'social' && <SocialTab />}
      {tab === 'badges' && <BadgesTab />}
    </div>
  );
}

/* ─── tab 1: texts ──────────────────────────────────────────────────── */

function TextsTab() {
  const [rows, setRows] = useState([]);
  const [changes, setChanges] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const json = await api('/api/admin/site-settings');
      setRows(json.settings || []);
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value ?? '']));
  const value = (key) => (key in changes ? changes[key] : stored[key] ?? '');
  const setValue = (key, v) =>
    setChanges((c) => {
      const next = { ...c, [key]: v };
      if (v === (stored[key] ?? '')) delete next[key];
      return next;
    });

  // Settings in these groups that this page has no field config for.
  const extras = (groupId) =>
    rows
      .filter((r) => r.group_name === groupId && !KNOWN_KEYS.has(r.key))
      .map((r) => ({ key: r.key, label: r.label || r.key, type: r.type, hint: r.description }));

  const changeCount = Object.keys(changes).length;

  async function save() {
    if (changeCount === 0) return;
    setSaving(true);
    try {
      await api('/api/admin/site-settings', {
        method: 'PUT',
        body: JSON.stringify({ updates: Object.entries(changes).map(([key, v]) => ({ key, value: v })) }),
      });
      toast.success('Footer texts saved');
      setChanges({});
      await load();
    } catch (e) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading footer texts…" />;
  if (loadError) {
    return (
      <Notice tone="error" title="Could not load site settings">
        {loadError}
      </Notice>
    );
  }

  const year = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] items-start">
        <div className="space-y-6">
          {SETTING_GROUPS.map((group) => (
            <Card key={group.id} title={group.title} description={group.description}>
              <div className="space-y-4">
                {[...group.fields, ...extras(group.id)].map((f) => (
                  <Field
                    key={f.key}
                    label={f.label}
                    htmlFor={`setting-${f.key}`}
                    hint={
                      f.key === 'copyright_text' && value(f.key).includes('{year}')
                        ? `${f.hint} Preview: ${value(f.key).replaceAll('{year}', year)}`
                        : f.hint
                    }
                  >
                    {f.type === 'textarea' ? (
                      <Textarea
                        id={`setting-${f.key}`}
                        rows={3}
                        className="min-h-0"
                        value={value(f.key)}
                        onChange={(e) => setValue(f.key, e.target.value)}
                        placeholder={f.placeholder}
                      />
                    ) : (
                      <Input
                        id={`setting-${f.key}`}
                        type={f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : 'text'}
                        className={f.type === 'url' ? 'font-mono text-[13px]' : undefined}
                        value={value(f.key)}
                        onChange={(e) => setValue(f.key, e.target.value)}
                        placeholder={f.placeholder}
                      />
                    )}
                    {f.key in changes && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                        Unsaved
                        <button
                          type="button"
                          onClick={() => setValue(f.key, stored[f.key] ?? '')}
                          className="inline-flex items-center gap-0.5 text-ink-500 hover:text-ink-900"
                        >
                          <RotateCcw className="w-3 h-3" /> undo
                        </button>
                      </span>
                    )}
                  </Field>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <div className="xl:sticky xl:top-6">
          <FooterPreview get={value} year={year} />
        </div>
      </div>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-white/95 backdrop-blur px-5 py-3 shadow-soft">
        <p className="text-[13px] text-ink-500">
          {changeCount > 0 ? `${changeCount} unsaved change${changeCount === 1 ? '' : 's'}` : 'All changes saved'}
        </p>
        <div className="flex items-center gap-2">
          {changeCount > 0 && (
            <Button variant="ghost" onClick={() => setChanges({})} disabled={saving}>
              Discard
            </Button>
          )}
          <Button variant="accent" icon={Save} loading={saving} disabled={changeCount === 0} onClick={save}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Rough sketch of the footer so admins see where each text goes. */
function FooterPreview({ get, year }) {
  const line = (w) => <span className={cn('block h-2 rounded-full bg-ink-100', w)} />;
  return (
    <Card title="Preview" description="Approximate layout of the footer." bodyClassName="p-3">
      <div className="relative overflow-hidden rounded-xl border border-ink-100 bg-white p-5">
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="relative grid grid-cols-2 gap-5">
          <div className="col-span-2">
            <p className="text-base font-black text-ink-900 mb-1.5">Famies</p>
            <p className="text-[12px] text-ink-500 leading-relaxed whitespace-pre-line">{get('footer_description') || '—'}</p>
          </div>
          <div>
            <p className="text-[12px] font-bold text-ink-900 mb-2">{get('footer_explore_heading') || 'Utforska'}</p>
            <div className="space-y-1.5">{line('w-16')}{line('w-20')}{line('w-14')}</div>
          </div>
          <div>
            <p className="text-[12px] font-bold text-ink-900 mb-2">{get('footer_company_heading') || 'Support'}</p>
            {get('contact_email') && (
              <p className="mb-1.5 flex items-center gap-1 text-[11px] text-ink-500 truncate">
                <Mail className="w-3 h-3 shrink-0" /> {get('contact_email')}
              </p>
            )}
            <div className="space-y-1.5">{line('w-20')}{line('w-16')}</div>
          </div>
          <div className="col-span-2">
            <p className="text-[12px] font-bold text-ink-900 mb-1">{get('footer_app_heading') || 'Hämta appen'}</p>
            <p className="text-[11px] text-ink-500 mb-2">{get('footer_app_text')}</p>
            <div className="flex gap-2">
              <span className={cn('px-2.5 py-1 rounded-lg border text-[10px] font-bold', get('app_store_url') ? 'border-ink-100 text-ink-700' : 'border-dashed border-ink-200 text-ink-300')}>
                App Store
              </span>
              <span className={cn('px-2.5 py-1 rounded-lg border text-[10px] font-bold', get('google_play_url') ? 'border-ink-100 text-ink-700' : 'border-dashed border-ink-200 text-ink-300')}>
                Google Play
              </span>
            </div>
          </div>
        </div>
        <div className="relative mt-5 pt-3 border-t border-ink-100 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] text-ink-500">{(get('copyright_text') || '').replaceAll('{year}', year)}</p>
          <p className="text-[10px] text-ink-500">{get('footer_tagline')}</p>
        </div>
      </div>
    </Card>
  );
}

/* ─── tab 2: social links ───────────────────────────────────────────── */

function SocialTab() {
  const { showConfirm } = useModal();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const json = await api('/api/admin/social-links');
      setItems((json.items || []).sort(bySort));
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    const e = editing;
    if (!e.label.trim() || !e.href.trim()) return toast.error('Label and URL are required');
    if (!/<svg[\s>]/i.test(e.icon_svg)) return toast.error('Paste <svg> markup or pick a preset icon');
    setSaving(true);
    try {
      const body = JSON.stringify({
        label: e.label.trim(),
        href: e.href.trim(),
        icon_svg: e.icon_svg.trim(),
        bg_color: e.bg_color.trim(),
        icon_color: e.icon_color.trim(),
        enabled: e.enabled,
      });
      if (e.id) await api(`/api/admin/social-links/${e.id}`, { method: 'PUT', body });
      else await api('/api/admin/social-links', { method: 'POST', body });
      toast.success(e.id ? 'Social link saved' : 'Social link added');
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(item) {
    const enabled = !item.enabled;
    setItems((all) => all.map((i) => (i.id === item.id ? { ...i, enabled } : i)));
    try {
      await api(`/api/admin/social-links/${item.id}`, { method: 'PUT', body: JSON.stringify({ enabled }) });
    } catch (e) {
      toast.error(e.message);
      load();
    }
  }

  async function remove(item) {
    const ok = await showConfirm(`Delete ${item.label}?`, 'The icon is removed from the footer. This cannot be undone.');
    if (!ok) return;
    try {
      await api(`/api/admin/social-links/${item.id}`, { method: 'DELETE' });
      toast.success('Social link deleted');
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function move(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next.map((i, n) => ({ ...i, sort_order: n + 1 })));
    try {
      await api('/api/admin/social-links', { method: 'PATCH', body: JSON.stringify({ order: next.map((i) => i.id) }) });
    } catch (e) {
      toast.error(`Reorder failed: ${e.message}`);
      load();
    }
  }

  const enabledItems = items.filter((i) => i.enabled);

  return (
    <Card
      title="Social links"
      description="Round icons under the footer description, in this order."
      actions={
        <Button variant="accent" size="sm" icon={Plus} onClick={() => setEditing({ ...EMPTY_SOCIAL })}>
          Add social link
        </Button>
      }
    >
      {loading ? (
        <LoadingBlock label="Loading social links…" />
      ) : loadError ? (
        <Notice tone="error" title="Could not load social links">
          {loadError}
        </Notice>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Share2}
          title="No social links yet"
          text="Add Instagram, TikTok, YouTube or any other profile."
          action={
            <Button variant="accent" icon={Plus} onClick={() => setEditing({ ...EMPTY_SOCIAL })}>
              Add social link
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={cn('flex items-center gap-3 rounded-xl border border-ink-100 p-3', item.enabled ? 'bg-white' : 'bg-ink-50')}
              >
                <div className="flex flex-col">
                  <IconButton title="Move up" disabled={idx === 0} onClick={() => move(idx, -1)}>
                    <ArrowUp className="w-3.5 h-3.5" />
                  </IconButton>
                  <IconButton title="Move down" disabled={idx === items.length - 1} onClick={() => move(idx, 1)}>
                    <ArrowDown className="w-3.5 h-3.5" />
                  </IconButton>
                </div>
                <SocialIcon svg={item.icon_svg} bg={item.bg_color} color={item.icon_color} className={cn(!item.enabled && 'opacity-50')} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn('text-[13px] font-bold', item.enabled ? 'text-ink-900' : 'text-ink-500')}>{item.label}</span>
                    {!item.enabled && <Badge tone="gray">Hidden</Badge>}
                  </div>
                  <p className="mt-0.5 font-mono text-[12px] text-ink-500 truncate">{item.href}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Toggle checked={item.enabled} onChange={() => toggleEnabled(item)} />
                  <IconButton title="Edit" onClick={() => setEditing({ ...item })}>
                    <Pencil className="w-4 h-4" />
                  </IconButton>
                  <IconButton title="Delete" onClick={() => remove(item)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-ink-100 bg-brand-gradient-soft px-4 py-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ink-300">Preview</p>
            {enabledItems.length === 0 ? (
              <p className="text-[13px] text-ink-500">No visible icons.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                {enabledItems.map((i) => (
                  <SocialIcon key={i.id} svg={i.icon_svg} bg={i.bg_color} color={i.icon_color} title={i.label} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {editing && (
        <Dialog
          title={editing.id ? `Edit ${editing.label || 'social link'}` : 'Add social link'}
          onClose={() => !saving && setEditing(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="accent" icon={Save} loading={saving} onClick={save}>
                {editing.id ? 'Save' : 'Add'}
              </Button>
            </>
          }
        >
          <SocialForm value={editing} onChange={setEditing} />
        </Dialog>
      )}
    </Card>
  );
}

function SocialForm({ value: v, onChange }) {
  const set = (patch) => onChange({ ...v, ...patch });
  const preset = SOCIAL_PRESETS.find((p) => p.label === v.label);

  function applyPreset(p) {
    set({
      label: p.label,
      icon_svg: svgIcon(p.d),
      href: v.href.trim() ? v.href : p.href || '',
    });
  }

  return (
    <div className="p-5 space-y-4">
      <Field label="Preset icons" hint="Fills in the label and icon. Colors and URL stay editable.">
        <div className="flex flex-wrap gap-2">
          {SOCIAL_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold transition-colors',
                v.label === p.label ? 'border-primary bg-primary-50 text-primary-700' : 'border-ink-100 text-ink-700 hover:border-ink-200 hover:bg-ink-50'
              )}
            >
              <span className="w-4 h-4 [&>svg]:w-4 [&>svg]:h-4" dangerouslySetInnerHTML={{ __html: svgIcon(p.d) }} />
              {p.label}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Label" htmlFor="social-label" hint="Used as the accessible name.">
          <Input id="social-label" value={v.label} onChange={(e) => set({ label: e.target.value })} placeholder="Instagram" />
        </Field>
        <Field label="Profile URL" htmlFor="social-href">
          <Input
            id="social-href"
            type="url"
            className="font-mono text-[13px]"
            value={v.href}
            onChange={(e) => set({ href: e.target.value })}
            placeholder={preset?.placeholder || 'https://…'}
          />
        </Field>
      </div>

      <Field label="Icon SVG" htmlFor="social-svg" hint='Paste full <svg> markup. Use viewBox and fill="currentColor" so the icon color applies; 20×20 works best.'>
        <Textarea
          id="social-svg"
          mono
          rows={4}
          className="text-[12px]"
          value={v.icon_svg}
          onChange={(e) => set({ icon_svg: e.target.value })}
          placeholder='<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">…</svg>'
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <ColorField label="Background color" value={v.bg_color} onChange={(bg_color) => set({ bg_color })} />
        <ColorField label="Icon color" value={v.icon_color} onChange={(icon_color) => set({ icon_color })} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-bold uppercase tracking-wide text-ink-500 mr-1">Quick colors</span>
        {[...COLOR_SWATCHES, ...(preset ? [{ label: `${preset.label} brand`, bg: preset.brand, icon: '#ffffff' }] : [])].map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => set({ bg_color: s.bg, icon_color: s.icon })}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-ink-100 text-[11px] font-semibold text-ink-700 hover:bg-ink-50"
          >
            <span className="w-3.5 h-3.5 rounded-full border border-ink-100" style={{ background: s.bg }} />
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-ink-100 bg-brand-gradient-soft px-4 py-3">
        <div className="flex items-center gap-3">
          <SocialIcon svg={v.icon_svg} bg={v.bg_color} color={v.icon_color} />
          <SocialIcon svg={v.icon_svg} bg={v.bg_color} color={v.icon_color} size="lg" />
          <span className="text-[12px] text-ink-500">Live preview</span>
        </div>
        <Toggle checked={v.enabled} onChange={(enabled) => set({ enabled })} label="Visible" />
      </div>
    </div>
  );
}

function SocialIcon({ svg, bg, color, size = 'md', title, className }) {
  const markup = previewSvg(svg);
  return (
    <span
      title={title}
      className={cn(
        'shrink-0 rounded-full flex items-center justify-center overflow-hidden border border-black/5',
        size === 'lg' ? 'w-14 h-14 [&>svg]:w-7 [&>svg]:h-7' : 'w-10 h-10 [&>svg]:w-5 [&>svg]:h-5',
        className
      )}
      style={{ background: bg || '#f3f4f6', color: color || '#4b5563' }}
      {...(markup
        ? { dangerouslySetInnerHTML: { __html: markup } }
        : { children: <span className="text-[10px] font-bold opacity-60">SVG</span> })}
    />
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input
          type="color"
          value={isHex(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-xl border border-ink-100 bg-white p-1"
          aria-label={`${label} picker`}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-[13px]" placeholder="#f3f4f6" />
      </div>
    </Field>
  );
}

/* ─── tab 3: footer badges ──────────────────────────────────────────── */

function BadgesTab() {
  const { showConfirm } = useModal();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const json = await api('/api/admin/footer-badges');
      setItems(json.items || []);
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    const e = editing;
    if (!e.image_url.trim() || !e.link_url.trim()) return toast.error('Image URL and link URL are required');
    setSaving(true);
    try {
      const original = e.id ? items.find((i) => i.id === e.id) : null;
      const payload = {
        location: e.location,
        image_url: e.image_url.trim(),
        link_url: e.link_url.trim(),
        alt_text: e.alt_text?.trim() || '',
        width: Number(e.width) || 120,
        height: e.height === '' || e.height == null ? null : Number(e.height) || null,
        enabled: e.enabled,
      };
      if (!original || original.location !== e.location) {
        const inTarget = items.filter((i) => i.location === e.location && i.id !== e.id);
        payload.sort_order = inTarget.reduce((max, i) => Math.max(max, i.sort_order ?? 0), 0) + 1;
      }
      const body = JSON.stringify(payload);
      if (e.id) await api(`/api/admin/footer-badges/${e.id}`, { method: 'PUT', body });
      else await api('/api/admin/footer-badges', { method: 'POST', body });
      toast.success(e.id ? 'Badge saved' : 'Badge added');
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(item) {
    const enabled = !item.enabled;
    setItems((all) => all.map((i) => (i.id === item.id ? { ...i, enabled } : i)));
    try {
      await api(`/api/admin/footer-badges/${item.id}`, { method: 'PUT', body: JSON.stringify({ enabled }) });
    } catch (e) {
      toast.error(e.message);
      load();
    }
  }

  async function remove(item) {
    const ok = await showConfirm('Delete this badge?', 'It is removed from the footer. This cannot be undone.');
    if (!ok) return;
    try {
      await api(`/api/admin/footer-badges/${item.id}`, { method: 'DELETE' });
      toast.success('Badge deleted');
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function move(list, index, dir) {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    const order = next.map((i) => i.id);
    const rank = new Map(order.map((id, n) => [id, n + 1]));
    setItems((all) => all.map((i) => (rank.has(i.id) ? { ...i, sort_order: rank.get(i.id) } : i)));
    try {
      await api('/api/admin/footer-badges', { method: 'PATCH', body: JSON.stringify({ order }) });
    } catch (e) {
      toast.error(`Reorder failed: ${e.message}`);
      load();
    }
  }

  const newBadge = (location = 'footer_explore') => setEditing({ ...EMPTY_BADGE, location });

  if (loading) return <LoadingBlock label="Loading badges…" />;
  if (loadError) {
    return (
      <Notice tone="error" title="Could not load footer badges">
        {loadError}
      </Notice>
    );
  }

  return (
    <div className="space-y-6">
      <Notice tone="info">
        Partner or award badges (for example “Featured on …”) shown under a footer link column. They link to the partner’s
        page and open in a new tab.
      </Notice>

      {BADGE_LOCATIONS.map((loc) => {
        const list = items.filter((i) => i.location === loc.id).sort(bySort);
        return (
          <Card
            key={loc.id}
            title={loc.label}
            description={`${list.length} badge${list.length === 1 ? '' : 's'}`}
            actions={
              <Button variant="secondary" size="sm" icon={Plus} onClick={() => newBadge(loc.id)}>
                Add badge
              </Button>
            }
          >
            {list.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-200 py-8 text-center text-[13px] text-ink-500">
                No badges here yet.
              </p>
            ) : (
              <div className="space-y-2">
                {list.map((item, idx) => (
                  <div
                    key={item.id}
                    className={cn('flex items-center gap-3 rounded-xl border border-ink-100 p-3', item.enabled ? 'bg-white' : 'bg-ink-50')}
                  >
                    <div className="flex flex-col">
                      <IconButton title="Move up" disabled={idx === 0} onClick={() => move(list, idx, -1)}>
                        <ArrowUp className="w-3.5 h-3.5" />
                      </IconButton>
                      <IconButton title="Move down" disabled={idx === list.length - 1} onClick={() => move(list, idx, 1)}>
                        <ArrowDown className="w-3.5 h-3.5" />
                      </IconButton>
                    </div>
                    <div className="w-28 h-14 shrink-0 rounded-lg border border-ink-100 bg-white flex items-center justify-center overflow-hidden p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image_url} alt={item.alt_text || ''} className={cn('max-w-full max-h-full object-contain', !item.enabled && 'opacity-50')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={cn('text-[13px] font-bold', item.enabled ? 'text-ink-900' : 'text-ink-500')}>
                          {item.alt_text || 'Badge'}
                        </span>
                        <Badge tone="gray">
                          {item.width}
                          {item.height ? `×${item.height}` : ''}px
                        </Badge>
                        {!item.enabled && <Badge tone="gray">Hidden</Badge>}
                      </div>
                      <p className="mt-0.5 font-mono text-[12px] text-ink-500 truncate">{item.link_url}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Toggle checked={item.enabled} onChange={() => toggleEnabled(item)} />
                      <IconButton
                        title="Edit"
                        onClick={() => setEditing({ ...item, alt_text: item.alt_text || '', height: item.height ?? '' })}
                      >
                        <Pencil className="w-4 h-4" />
                      </IconButton>
                      <IconButton title="Delete" onClick={() => remove(item)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {editing && (
        <Dialog
          title={editing.id ? 'Edit badge' : 'Add badge'}
          onClose={() => !saving && setEditing(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="accent" icon={Save} loading={saving} onClick={save}>
                {editing.id ? 'Save' : 'Add'}
              </Button>
            </>
          }
        >
          <BadgeForm value={editing} onChange={setEditing} />
        </Dialog>
      )}
    </div>
  );
}

function BadgeForm({ value: v, onChange }) {
  const set = (patch) => onChange({ ...v, ...patch });
  return (
    <div className="p-5 space-y-4">
      <Field label="Location" htmlFor="badge-location">
        <Select id="badge-location" value={v.location} onChange={(e) => set({ location: e.target.value })}>
          {BADGE_LOCATIONS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </Select>
      </Field>
      <ImageField label="Image URL" value={v.image_url} onChange={(image_url) => set({ image_url })} />
      <Field label="Link URL" htmlFor="badge-link" hint="Where the badge links to.">
        <Input
          id="badge-link"
          type="url"
          className="font-mono text-[13px]"
          value={v.link_url}
          onChange={(e) => set({ link_url: e.target.value })}
          placeholder="https://…"
        />
      </Field>
      <Field label="Alt text" htmlFor="badge-alt" hint="Describe the badge, e.g. “Famies – Featured on …”.">
        <Input id="badge-alt" value={v.alt_text} onChange={(e) => set({ alt_text: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Width (px)" htmlFor="badge-width">
          <Input id="badge-width" type="number" min={1} max={2000} value={v.width} onChange={(e) => set({ width: e.target.value })} />
        </Field>
        <Field label="Height (px, optional)" htmlFor="badge-height" hint="Empty = keep aspect ratio.">
          <Input id="badge-height" type="number" min={1} max={2000} value={v.height} onChange={(e) => set({ height: e.target.value })} />
        </Field>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-ink-100 bg-brand-gradient-soft px-4 py-3">
        <div className="min-w-0 overflow-hidden">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ink-300">Live preview</p>
          {v.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={v.image_url}
              alt={v.alt_text || ''}
              style={{ width: Number(v.width) || 120, height: Number(v.height) || 'auto', maxWidth: '100%' }}
            />
          ) : (
            <p className="text-[12px] text-ink-500">Add an image URL to see the badge.</p>
          )}
        </div>
        <Toggle checked={v.enabled} onChange={(enabled) => set({ enabled })} label="Visible" />
      </div>
    </div>
  );
}

/* ─── shared bits ───────────────────────────────────────────────────── */

function IconButton({ title, onClick, disabled, className, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-1.5 rounded-lg text-ink-500 hover:text-ink-900 hover:bg-ink-100/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
        className
      )}
    >
      {children}
    </button>
  );
}

function Dialog({ title, onClose, footer, children }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-3 sm:p-6 bg-ink-900/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-2xl max-h-[94vh] flex flex-col rounded-2xl bg-white border border-ink-100 shadow-2xl">
        <header className="flex items-center justify-between gap-4 px-5 py-4 border-b border-ink-100">
          <h2 className="text-[15px] font-bold text-ink-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-ink-300 hover:text-ink-900 hover:bg-ink-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 px-5 py-4 border-t border-ink-100">{footer}</footer>}
      </div>
    </div>
  );
}

/** URL input + upload (POST /api/admin/upload → { url }). */
function ImageField({ label, value, onChange, hint }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error || `Upload failed (${res.status})`);
      onChange(json.url);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Field label={label} hint={hint}>
      <div className="flex gap-2">
        <Input className="font-mono text-[13px]" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <Button variant="secondary" icon={Upload} loading={uploading} onClick={() => fileRef.current?.click()}>
          Upload
        </Button>
      </div>
    </Field>
  );
}
