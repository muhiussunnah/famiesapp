'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Code, Plus, Trash2, Pencil, Copy, Check, X, AlertTriangle, Wand2 } from 'lucide-react';
import {
  PageHeader, Card, Button, Field, Input, Textarea, Toggle, Badge, Notice, EmptyState, LoadingBlock,
} from '@/components/admin/ui';
import { useModal } from '@/components/admin/AdminModal';
import { splitHeadSnippets } from '@/lib/render-head-script';
import { cn } from '@/lib/utils';

const POSITIONS = [
  {
    value: 'head',
    label: '<head>',
    help: 'Loads before the page renders. Use it for Google Analytics / Tag Manager, Search Console and Bing verification, and pixel init. Only <script>, <meta>, <link> and <style> tags work here.',
  },
  {
    value: 'body_start',
    label: '<body> start',
    help: 'Placed right after <body> opens. Use it for the Google Tag Manager <noscript> iframe.',
  },
  {
    value: 'body_end',
    label: '<body> end',
    help: 'Placed just before </body> closes. Use it for chat widgets and analytics that should load last.',
  },
];

const POSITION_LABEL = Object.fromEntries(POSITIONS.map((p) => [p.value, p.label]));

/** Ready-made snippets. Replace the placeholder IDs before saving. */
const PRESETS = [
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    position: 'head',
    hint: 'Replace both G-XXXXXXXXXX with your Measurement ID (Analytics → Admin → Data streams).',
    code: `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>`,
  },
  {
    id: 'gtm',
    name: 'Google Tag Manager',
    position: 'head',
    hint: 'Replace GTM-XXXXXXX with your container ID. Add the "GTM (noscript)" preset too, as a separate <body> start script.',
    code: `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXX');</script>`,
  },
  {
    id: 'gtm-noscript',
    name: 'GTM (noscript)',
    position: 'body_start',
    hint: 'Replace GTM-XXXXXXX with your container ID. This part must sit at <body> start; <head> cannot hold an iframe.',
    code: `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXXX"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`,
  },
  {
    id: 'gsc',
    name: 'Google Search Console',
    position: 'head',
    hint: 'Search Console → Add property → URL prefix → "HTML tag". Paste only the <meta> tag it gives you.',
    code: `<meta name="google-site-verification" content="YOUR_VERIFICATION_CODE" />`,
  },
  {
    id: 'bing',
    name: 'Bing Webmaster Tools',
    position: 'head',
    hint: 'Bing Webmaster Tools → Add site → "HTML Meta Tag". Paste only the <meta> tag.',
    code: `<meta name="msvalidate.01" content="YOUR_VERIFICATION_CODE" />`,
  },
  {
    id: 'meta-pixel',
    name: 'Meta Pixel',
    position: 'head',
    hint: "Replace YOUR_PIXEL_ID. Meta's <noscript><img> fallback can't go in <head>; add it as a separate <body> start script if you need it.",
    code: `<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', 'YOUR_PIXEL_ID');
fbq('track', 'PageView');
</script>`,
  },
  {
    id: 'fb-domain',
    name: 'Meta domain verification',
    position: 'head',
    hint: 'Meta Business Settings → Brand safety → Domains → "Meta-tag verification".',
    code: `<meta name="facebook-domain-verification" content="YOUR_VERIFICATION_CODE" />`,
  },
  {
    id: 'clarity',
    name: 'Microsoft Clarity',
    position: 'head',
    hint: 'Replace YOUR_PROJECT_ID with the ID from Clarity → Settings → Setup.',
    code: `<script type="text/javascript">
(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "YOUR_PROJECT_ID");
</script>`,
  },
];

// Mirrors the tag patterns renderHeadScript() (src/lib/render-head-script.js)
// accepts, so the admin sees BEFORE saving what <head> will silently skip.
const HEAD_RENDERABLE = [
  /^<meta\b[^>]*?\s*\/?>$/i,
  /^<link\b[^>]*?\s*\/?>$/i,
  /^<script\b[^>]*>[\s\S]*?<\/script>$/i,
  /^<style\b[^>]*>[\s\S]*?<\/style>$/i,
];
const VERIFICATION_META =
  /<meta\b[^>]*name\s*=\s*["']?(google-site-verification|msvalidate\.01|facebook-domain-verification|p:domain_verify|yandex-verification)/i;
const PLACEHOLDER = /\bG-X{6,}\b|\bGTM-X{5,}\b|\bYOUR_[A-Z_]+\b/;

function excerpt(text, max = 90) {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

/** Problems that would stop a snippet from working where it is placed. */
function analyzeScript(code, position) {
  const issues = [];
  const src = (code || '').trim();
  if (!src) return issues;

  const html = src.replace(/<!--[\s\S]*?-->/g, '').trim();

  if (!/<[a-z]/i.test(html)) {
    issues.push('No HTML tags found. Wrap JavaScript in <script>…</script>, otherwise it is printed as text (or skipped in <head>).');
    return issues;
  }

  const opens = (html.match(/<script\b/gi) || []).length;
  const closes = (html.match(/<\/script>/gi) || []).length;
  if (opens !== closes) {
    issues.push(`Found ${opens} <script> and ${closes} </script> tags. A script tag is not closed.`);
  }

  if (position === 'head') {
    const renderable = splitHeadSnippets(html).filter((s) => HEAD_RENDERABLE.some((re) => re.test(s.trim())));
    let leftover = html;
    for (const s of renderable) leftover = leftover.replace(s, '');
    leftover = leftover.trim();

    if (renderable.length === 0) {
      issues.push('Nothing here can be rendered in <head>. Only <script>, <meta>, <link> and <style> tags are supported. Move other HTML to <body> start or <body> end.');
    } else if (leftover) {
      issues.push(`This part will be skipped in <head>: "${excerpt(leftover)}". Only <script>, <meta>, <link> and <style> tags are kept. Add it as a separate <body> start script instead.`);
    }
  } else if (VERIFICATION_META.test(html)) {
    issues.push('Site-verification <meta> tags are only read inside <head>. Change the position to <head>.');
  }

  if (PLACEHOLDER.test(src)) {
    issues.push('Contains a placeholder ID (G-XXXXXXXXXX, GTM-XXXXXXX or YOUR_…). Replace it with your real ID.');
  }

  return issues;
}

const EMPTY_FORM = { name: '', code: '', position: 'head', enabled: true, sort_order: 0 };

export default function HeaderScriptsPage() {
  const { showConfirm } = useModal();

  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [presetId, setPresetId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/scripts', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to load scripts');
      setScripts(json.scripts || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closeForm = useCallback(() => {
    if (saving) return;
    setShowForm(false);
    setEditing(null);
  }, [saving]);

  useEffect(() => {
    if (!showForm) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // A confirm dialog (useModal) open on top handles its own Escape.
      if (document.querySelectorAll('[role="dialog"]').length > 1) return;
      closeForm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showForm, closeForm]);

  function openNew() {
    setEditing(null);
    setPresetId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(s) {
    setEditing(s);
    setPresetId(null);
    setForm({ name: s.name, code: s.code, position: s.position, enabled: s.enabled, sort_order: s.sort_order ?? 0 });
    setShowForm(true);
  }

  async function applyPreset(preset) {
    const hasOtherCode = form.code.trim() && !PRESETS.some((p) => p.code === form.code);
    if (hasOtherCode) {
      const ok = await showConfirm('Replace code?', `The code you typed will be replaced with the ${preset.name} snippet.`, 'warning', {
        confirmText: 'Replace',
      });
      if (!ok) return;
    }
    const nameIsDefault = !form.name.trim() || PRESETS.some((p) => p.name === form.name);
    setForm((f) => ({ ...f, name: nameIsDefault ? preset.name : f.name, position: preset.position, code: preset.code }));
    setPresetId(preset.id);
  }

  const formIssues = useMemo(() => analyzeScript(form.code, form.position), [form.code, form.position]);
  const activePreset = PRESETS.find((p) => p.id === presetId);
  const positionHelp = POSITIONS.find((p) => p.value === form.position)?.help;

  async function save() {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error('Name and code are required');
      return;
    }
    if (formIssues.length > 0) {
      const ok = await showConfirm('Save with warnings?', formIssues.map((i) => `• ${i}`).join('\n\n'), 'warning', {
        confirmText: 'Save anyway',
      });
      if (!ok) return;
    }

    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/admin/scripts/${editing.id}` : '/api/admin/scripts', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, name: form.name.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      toast.success(editing ? 'Script updated' : 'Script added');
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(s) {
    const next = !s.enabled;
    setScripts((list) => list.map((x) => (x.id === s.id ? { ...x, enabled: next } : x)));
    try {
      const res = await fetch(`/api/admin/scripts/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to update');
      toast.success(next ? `"${s.name}" enabled` : `"${s.name}" paused`);
      await load();
    } catch (e) {
      setScripts((list) => list.map((x) => (x.id === s.id ? { ...x, enabled: s.enabled } : x)));
      toast.error(e.message);
    }
  }

  async function remove(s) {
    const ok = await showConfirm('Delete script?', `"${s.name}" will be removed from every page. This cannot be undone.`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/scripts/${s.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to delete');
      toast.success('Script deleted');
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function copyCode(s) {
    try {
      await navigator.clipboard.writeText(s.code);
      setCopied(s.id);
      setTimeout(() => setCopied((c) => (c === s.id ? null : c)), 1500);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  const activeCount = scripts.filter((s) => s.enabled).length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Code}
        title="Header Scripts"
        description="Add Google Analytics, Search Console, Meta Pixel or any custom HTML/JS to every page of famies.app."
        actions={
          <Button variant="accent" icon={Plus} onClick={openNew}>
            Add script
          </Button>
        }
      />

      <Notice tone="info" title="How it works">
        Scripts are injected sitewide. Use <code className="rounded bg-white/70 px-1 text-[12px]">&lt;script&gt;</code>,{' '}
        <code className="rounded bg-white/70 px-1 text-[12px]">&lt;meta&gt;</code> and{' '}
        <code className="rounded bg-white/70 px-1 text-[12px]">&lt;link&gt;</code> tags. Changes are live on the public site as soon as you
        save. Within a position, scripts load in ascending <strong>load order</strong>.
      </Notice>

      {loading ? (
        <LoadingBlock label="Loading scripts…" />
      ) : error ? (
        <Notice tone="error" title="Could not load scripts">
          {error}
        </Notice>
      ) : scripts.length === 0 ? (
        <Card>
          <EmptyState
            icon={Code}
            title="No scripts yet"
            text="Add your first script to start tracking visitors or to verify the site with Google and Bing."
            action={
              <Button variant="accent" icon={Plus} onClick={openNew}>
                Add your first script
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] font-semibold text-ink-500">
            {scripts.length} {scripts.length === 1 ? 'script' : 'scripts'} · {activeCount} active
          </p>
          {scripts.map((s) => {
            const issues = analyzeScript(s.code, s.position);
            return (
              <Card key={s.id} bodyClassName="p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-[15px] font-bold text-ink-900">{s.name}</h3>
                      <Badge tone="violet" className="font-mono">
                        {POSITION_LABEL[s.position] || s.position}
                      </Badge>
                      {s.enabled ? <Badge tone="green">ACTIVE</Badge> : <Badge tone="gray">PAUSED</Badge>}
                      {issues.length > 0 && (
                        <Badge tone="amber">
                          <AlertTriangle className="h-3 w-3" />
                          {issues.length} {issues.length === 1 ? 'warning' : 'warnings'}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] text-ink-300">
                      Load order {s.sort_order ?? 0} · Updated {new Date(s.updated_at).toLocaleString('en-GB')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Toggle checked={s.enabled} onChange={() => toggleEnabled(s)} className="mr-2" />
                    <Button variant="ghost" size="sm" onClick={() => copyCode(s)} title="Copy code" aria-label="Copy code">
                      {copied === s.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(s)} title="Edit" aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(s)}
                      title="Delete"
                      aria-label="Delete"
                      className="text-red-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <pre className="max-h-32 overflow-auto rounded-xl border border-ink-100 bg-ink-50 p-3 font-mono text-[12px] leading-relaxed text-ink-700">
                  <code>{s.code.length > 500 ? `${s.code.slice(0, 500)}…` : s.code}</code>
                </pre>

                {issues.length > 0 && (
                  <Notice tone="warning">
                    <ul className="list-disc space-y-1 pl-4">
                      {issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </Notice>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / edit dialog */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm"
          onClick={closeForm}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="script-form-title"
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
              <h2 id="script-form-title" className="text-[16px] font-bold text-ink-900">
                {editing ? 'Edit script' : 'Add new script'}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Close"
                className="rounded-lg p-1.5 text-ink-300 transition-colors hover:bg-ink-50 hover:text-ink-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {!editing && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-ink-500">
                    <Wand2 className="h-3.5 w-3.5" /> Quick start
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyPreset(p)}
                        className={cn(
                          'rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-colors',
                          presetId === p.id
                            ? 'border-primary bg-primary/10 text-primary-700'
                            : 'border-ink-100 text-ink-700 hover:border-ink-200 hover:bg-ink-50'
                        )}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                  {activePreset?.hint && <Notice tone="info">{activePreset.hint}</Notice>}
                </div>
              )}

              <Field label="Script name" htmlFor="script-name">
                <Input
                  id="script-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Google Analytics, Meta Pixel, Search Console"
                />
              </Field>

              <Field label="Position" hint={positionHelp}>
                <div className="grid grid-cols-3 gap-2">
                  {POSITIONS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setForm({ ...form, position: p.value })}
                      className={cn(
                        'rounded-xl border px-3 py-2.5 font-mono text-[12px] font-semibold transition-colors',
                        form.position === p.value
                          ? 'border-primary bg-primary/10 text-primary-700 ring-2 ring-primary/20'
                          : 'border-ink-100 text-ink-700 hover:border-ink-200 hover:bg-ink-50'
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Code (HTML / JavaScript)" htmlFor="script-code">
                <Textarea
                  id="script-code"
                  mono
                  rows={12}
                  spellCheck={false}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder={'<!-- Google Tag Manager -->\n<script>(function(w,d,s,l,i){...})</script>\n<!-- End Google Tag Manager -->'}
                  className="text-[12px]"
                />
              </Field>

              {formIssues.length > 0 && (
                <Notice tone="warning" title="Check this snippet">
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {formIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </Notice>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label="Load order" htmlFor="script-order" hint="Lower numbers load first.">
                  <Input
                    id="script-order"
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: Number.parseInt(e.target.value, 10) || 0 })}
                  />
                </Field>
                <Field label="Status">
                  <div className="flex h-10 items-center">
                    <Toggle
                      checked={form.enabled}
                      onChange={(v) => setForm({ ...form, enabled: v })}
                      label={form.enabled ? 'Enabled' : 'Disabled'}
                    />
                  </div>
                </Field>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-4">
              <Button variant="secondary" onClick={closeForm} disabled={saving}>
                Cancel
              </Button>
              <Button variant="accent" icon={Check} loading={saving} onClick={save}>
                {editing ? 'Save changes' : 'Add script'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
