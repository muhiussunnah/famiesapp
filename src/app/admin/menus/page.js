'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ListOrdered, Plus, Pencil, Trash2, ArrowUp, ArrowDown, ExternalLink, Link2, X, Save,
} from 'lucide-react';
import {
  PageHeader, Card, Button, Field, Input, Select, Toggle, Badge, Notice, EmptyState, LoadingBlock,
} from '@/components/admin/ui';
import { useModal } from '@/components/admin/AdminModal';
import { cn } from '@/lib/utils';

const LOCATIONS = [
  { id: 'header', label: 'Header menu', description: 'Main navigation links at the top of every page.' },
  { id: 'footer_explore', label: 'Footer – Utforska column', description: 'First link column in the footer.' },
  { id: 'footer_company', label: 'Footer – Support column', description: 'Second link column in the footer (contact and legal pages).' },
  { id: 'footer_bottom', label: 'Footer – bottom bar', description: 'Small links next to the copyright line.' },
];

// Suggestions for the URL field.
const COMMON_URLS = [
  '/', '/inspiration', '/skapa-event', '/contact', '/privacy', '/terms', '/deletion',
  '/#how', '/#features', '/#reviews', '/#download',
];

const EMPTY_FORM = { label: '', url: '', target: '_self', enabled: true, location: 'header' };

async function api(url, options = {}) {
  const res = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

const bySort = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0);

export default function MenusAdminPage() {
  const { showConfirm } = useModal();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [active, setActive] = useState('header');
  const [form, setForm] = useState(null); // { ...fields, id? }
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const json = await api('/api/admin/menus');
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

  const location = LOCATIONS.find((l) => l.id === active) || LOCATIONS[0];
  const list = items.filter((i) => i.location === active).sort(bySort);
  const anyEnabled = items.some((i) => i.enabled);

  function openNew() {
    setForm({ ...EMPTY_FORM, location: active });
  }

  function openEdit(item) {
    setForm({ id: item.id, label: item.label, url: item.url, target: item.target || '_self', enabled: item.enabled, location: item.location });
  }

  async function save() {
    if (!form.label.trim() || !form.url.trim()) {
      toast.error('Label and URL are required');
      return;
    }
    setSaving(true);
    try {
      const original = form.id ? items.find((i) => i.id === form.id) : null;
      const payload = {
        label: form.label.trim(),
        url: form.url.trim(),
        target: form.target,
        enabled: form.enabled,
        location: form.location,
      };
      // Moving to another location (or creating): append at the end there.
      if (!original || original.location !== form.location) {
        const inTarget = items.filter((i) => i.location === form.location && i.id !== form.id);
        payload.sort_order = inTarget.reduce((max, i) => Math.max(max, i.sort_order ?? 0), 0) + 1;
      }
      if (form.id) {
        await api(`/api/admin/menus/${form.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/api/admin/menus', { method: 'POST', body: JSON.stringify(payload) });
      }
      toast.success(form.id ? 'Link saved' : 'Link added');
      setActive(form.location);
      setForm(null);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(item) {
    const enabled = !item.enabled;
    setItems((all) => all.map((i) => (i.id === item.id ? { ...i, enabled } : i)));
    try {
      await api(`/api/admin/menus/${item.id}`, { method: 'PUT', body: JSON.stringify({ enabled }) });
    } catch (e) {
      toast.error(e.message);
      load();
    }
  }

  async function remove(item) {
    const ok = await showConfirm(`Delete “${item.label}”?`, 'The link is removed from the menu. This cannot be undone.');
    if (!ok) return;
    try {
      await api(`/api/admin/menus/${item.id}`, { method: 'DELETE' });
      toast.success('Link deleted');
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function move(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    const order = next.map((i) => i.id);
    const rank = new Map(order.map((id, i) => [id, i + 1]));
    setItems((all) => all.map((i) => (rank.has(i.id) ? { ...i, sort_order: rank.get(i.id) } : i)));
    try {
      await api('/api/admin/menus', { method: 'PATCH', body: JSON.stringify({ order }) });
    } catch (e) {
      toast.error(`Reorder failed: ${e.message}`);
      load();
    }
  }

  const enabledLinks = list.filter((i) => i.enabled);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ListOrdered}
        title="Menus"
        description="Header navigation and footer links across famies.app."
        actions={
          <Button variant="accent" icon={Plus} onClick={openNew}>
            Add link
          </Button>
        }
      />

      <Notice tone="info">
        Footer column headings (“Utforska”, “Support”) are edited under{' '}
        <Link href="/admin/footer-settings" className="font-bold underline underline-offset-2">
          Footer Content
        </Link>
        . If no menu link is enabled at all, the site falls back to the built-in Famies menus.
      </Notice>

      {!loading && !loadError && items.length > 0 && !anyEnabled && (
        <Notice tone="warning">Every link is disabled, so the site is currently showing the built-in default menus.</Notice>
      )}

      {/* Location tabs */}
      <div className="flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-white border border-ink-100">
        {LOCATIONS.map((loc) => {
          const isActive = loc.id === active;
          const count = items.filter((i) => i.location === loc.id).length;
          return (
            <button
              key={loc.id}
              type="button"
              onClick={() => setActive(loc.id)}
              className={cn(
                'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-colors',
                isActive ? 'bg-primary/15 text-primary-700' : 'text-ink-500 hover:text-ink-900 hover:bg-ink-50'
              )}
            >
              {loc.label}
              <span
                className={cn(
                  'min-w-[20px] px-1.5 py-0.5 rounded-md text-[10px] font-bold',
                  isActive ? 'bg-primary/20 text-primary-700' : 'bg-ink-50 text-ink-500'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <Card
        title={location.label}
        description={location.description}
        actions={
          list.length > 0 && (
            <Button variant="secondary" size="sm" icon={Plus} onClick={openNew}>
              Add link
            </Button>
          )
        }
      >
        {loading ? (
          <LoadingBlock label="Loading menus…" />
        ) : loadError ? (
          <Notice tone="error" title="Could not load menus">
            {loadError}
          </Notice>
        ) : list.length === 0 ? (
          <EmptyState
            icon={Link2}
            title="No links yet"
            text={`Add the first link to the ${location.label.toLowerCase()}.`}
            action={
              <Button variant="accent" icon={Plus} onClick={openNew}>
                Add link
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {list.map((item, idx) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border border-ink-100 p-3',
                    item.enabled ? 'bg-white' : 'bg-ink-50'
                  )}
                >
                  <div className="flex flex-col">
                    <IconButton title="Move up" disabled={idx === 0} onClick={() => move(idx, -1)}>
                      <ArrowUp className="w-3.5 h-3.5" />
                    </IconButton>
                    <IconButton title="Move down" disabled={idx === list.length - 1} onClick={() => move(idx, 1)}>
                      <ArrowDown className="w-3.5 h-3.5" />
                    </IconButton>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cn('text-[13px] font-bold', item.enabled ? 'text-ink-900' : 'text-ink-500')}>{item.label}</span>
                      {item.target === '_blank' && (
                        <Badge tone="blue">
                          <ExternalLink className="w-3 h-3" /> New tab
                        </Badge>
                      )}
                      {!item.enabled && <Badge tone="gray">Hidden</Badge>}
                    </div>
                    <p className="mt-0.5 font-mono text-[12px] text-ink-500 truncate">{item.url}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Toggle checked={item.enabled} onChange={() => toggleEnabled(item)} />
                    <IconButton title="Edit" onClick={() => openEdit(item)}>
                      <Pencil className="w-4 h-4" />
                    </IconButton>
                    <IconButton title="Delete" onClick={() => remove(item)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>

            {/* Mini preview of the visible links */}
            <div className="rounded-xl border border-ink-100 bg-brand-gradient-soft px-4 py-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ink-300">Preview</p>
              {enabledLinks.length === 0 ? (
                <p className="text-[13px] text-ink-500">No visible links in this menu.</p>
              ) : (
                <div
                  className={cn(
                    'flex',
                    active === 'header' || active === 'footer_bottom' ? 'flex-wrap items-center gap-x-5 gap-y-2' : 'flex-col gap-2'
                  )}
                >
                  {enabledLinks.map((i) => (
                    <span
                      key={i.id}
                      className={cn(
                        'inline-flex items-center gap-1',
                        active === 'header' ? 'text-sm font-bold text-ink-900' : active === 'footer_bottom' ? 'text-xs text-ink-500' : 'text-sm text-ink-500'
                      )}
                    >
                      {i.label}
                      {i.target === '_blank' && <ExternalLink className="w-3 h-3 text-ink-300" />}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {form && (
        <div
          className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-3 sm:p-6 bg-ink-900/40 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setForm(null);
          }}
        >
          <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white border border-ink-100 shadow-2xl">
            <header className="flex items-center justify-between gap-4 px-5 py-4 border-b border-ink-100">
              <h2 className="text-[15px] font-bold text-ink-900">{form.id ? 'Edit link' : 'Add link'}</h2>
              <button
                type="button"
                onClick={() => !saving && setForm(null)}
                aria-label="Close"
                className="p-1.5 rounded-lg text-ink-300 hover:text-ink-900 hover:bg-ink-50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <div className="p-5 space-y-4">
                <Field label="Label (shown on the site)" htmlFor="menu-label">
                  <Input
                    id="menu-label"
                    autoFocus
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    placeholder="t.ex. Inspiration"
                  />
                </Field>
                <Field
                  label="URL"
                  htmlFor="menu-url"
                  hint="Internal pages as a path (/inspiration, /#features), external links as a full URL (https://…)."
                >
                  <Input
                    id="menu-url"
                    list="menu-url-suggestions"
                    className="font-mono"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="/inspiration"
                  />
                  <datalist id="menu-url-suggestions">
                    {COMMON_URLS.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </Field>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Location" htmlFor="menu-location">
                    <Select id="menu-location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
                      {LOCATIONS.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Open in" htmlFor="menu-target">
                    <Select id="menu-target" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}>
                      <option value="_self">Same tab</option>
                      <option value="_blank">New tab</option>
                    </Select>
                  </Field>
                </div>
                <Toggle checked={form.enabled} onChange={(enabled) => setForm({ ...form, enabled })} label="Visible on the site" />
              </div>

              <footer className="flex items-center justify-end gap-2 px-5 py-4 border-t border-ink-100">
                <Button variant="secondary" onClick={() => setForm(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" icon={Save} loading={saving}>
                  {form.id ? 'Save link' : 'Add link'}
                </Button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

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
