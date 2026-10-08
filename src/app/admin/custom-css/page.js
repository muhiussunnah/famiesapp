'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Paintbrush, Save, Check, Eraser } from 'lucide-react';
import { PageHeader, Button, Notice, LoadingBlock } from '@/components/admin/ui';
import { useModal } from '@/components/admin/AdminModal';

/**
 * Global Custom CSS, WordPress "Additional CSS" style (site_settings key
 * `global_custom_css`).
 *
 * The root layout injects these rules into every page's <head> after the
 * site stylesheet, so source order lets them win over the defaults. Use
 * `!important` when a rule also has to beat a Tailwind utility class.
 */
const KEY = 'global_custom_css';

const PLACEHOLDER = `/* Example overrides */

/* Rounder buttons everywhere */
.press {
  border-radius: 9999px !important;
}

/* Hide an element on mobile only */
@media (max-width: 640px) {
  .hide-on-mobile { display: none; }
}`;

function Kbd({ children }) {
  return (
    <kbd className="rounded border border-sky-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-ink-700">{children}</kbd>
  );
}

export default function CustomCssPage() {
  const { showConfirm } = useModal();

  const [css, setCss] = useState('');
  const [originalCss, setOriginalCss] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState(null);
  const taRef = useRef(null);
  const savedTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/site-settings?group=styling', { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Failed to load');
        const row = (json.settings || []).find((s) => s.key === KEY);
        const value = row?.value ?? '';
        if (cancelled) return;
        setCss(value);
        setOriginalCss(value);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(savedTimer.current);
    };
  }, []);

  const dirty = css !== originalCss;

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ key: KEY, value: css }] }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      setOriginalCss(css);
      setJustSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setJustSaved(false), 3000);
      toast.success('Custom CSS saved');
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }, [css]);

  async function clearAll() {
    if (!css) return;
    const ok = await showConfirm(
      'Clear all custom CSS?',
      'This removes every rule you have added. You still need to press Save afterwards.',
      'danger',
      { confirmText: 'Clear' }
    );
    if (!ok) return;
    setCss('');
    taRef.current?.focus();
  }

  function handleKeyDown(e) {
    // Tab inserts 2 spaces instead of moving focus (code-editor UX).
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      setCss(css.substring(0, start) + '  ' + css.substring(end));
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
    // Ctrl/Cmd+S saves without leaving the editor.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (!saving && dirty) save();
    }
  }

  const charCount = css.length;

  return (
    <div className="max-w-5xl space-y-5">
      <PageHeader
        icon={Paintbrush}
        title="Custom CSS"
        description={
          <>
            Sitewide CSS injected into every page&apos;s{' '}
            <code className="rounded bg-ink-50 px-1.5 py-0.5 text-[12px] text-ink-700">&lt;head&gt;</code>. It loads after the global
            stylesheet so your rules win by source order, just like WordPress &ldquo;Additional CSS&rdquo;.
          </>
        }
        actions={
          <>
            <Button variant="danger" icon={Eraser} onClick={clearAll} disabled={!css || saving || loading}>
              Clear
            </Button>
            <Button variant="accent" icon={justSaved && !dirty ? Check : Save} loading={saving} onClick={save} disabled={!dirty || loading}>
              {saving ? 'Saving…' : justSaved && !dirty ? 'Saved' : 'Save CSS'}
            </Button>
          </>
        }
      />

      {error && (
        <Notice tone="error" title="Something went wrong">
          {error}
        </Notice>
      )}

      <Notice tone="info">
        <strong>Tip:</strong> use <code className="rounded bg-white/70 px-1 text-[12px]">!important</code> when overriding Tailwind utility
        classes. Press <Kbd>Ctrl</Kbd> + <Kbd>S</Kbd> (<Kbd>⌘</Kbd> + <Kbd>S</Kbd> on Mac) to save. Tab inserts 2 spaces.
      </Notice>

      {/* Editor */}
      <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-[0_1px_2px_rgba(12,10,19,0.04)]">
        <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-3 font-mono text-[12px] text-ink-500">
              global.css
              {dirty && (
                <span className="ml-1.5 text-amber-500" title="Unsaved changes">
                  ●
                </span>
              )}
            </span>
            {dirty && <span className="text-[11px] font-semibold text-amber-600">Unsaved changes</span>}
          </div>
          <span className="font-mono text-[11px] text-ink-300">
            {charCount.toLocaleString('en-US')} {charCount === 1 ? 'char' : 'chars'}
          </span>
        </div>

        {loading ? (
          <LoadingBlock className="h-[560px]" label="Loading CSS…" />
        ) : (
          <textarea
            ref={taRef}
            value={css}
            onChange={(e) => setCss(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            placeholder={PLACEHOLDER}
            aria-label="Global custom CSS"
            className="block min-h-[560px] w-full resize-y bg-transparent p-5 font-mono text-[13px] leading-relaxed text-ink-900 placeholder:text-ink-300 focus:outline-none"
            style={{ tabSize: 2 }}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-300">
        <span>Changes go live as soon as you save. No deploy required.</span>
        <span>&bull;</span>
        <span>Hard refresh the site if you don&apos;t see an update.</span>
        <span>&bull;</span>
        <span>Per-page CSS (set on an article) still wins over global CSS.</span>
      </div>
    </div>
  );
}
