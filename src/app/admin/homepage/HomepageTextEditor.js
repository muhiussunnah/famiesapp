'use client';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Save, RotateCcw, Plus, Trash2, ArrowUp, ArrowDown, Undo2 } from 'lucide-react';
import { Card, Button, Field, Input, Textarea, Toggle, LoadingBlock, Notice } from '@/components/admin/ui';
import ImageField from '@/components/admin/ImageField';
import { formatText } from '@/components/FormattedText';
import {
  HOMEPAGE_TEXT_DEFAULTS,
  HOMEPAGE_TEXT_KEY,
  HOMEPAGE_TEXT_SECTIONS,
  homepageTextFromSettings,
} from '@/lib/homepage-text';
import { cn } from '@/lib/utils';

const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * "Homepage text": every heading and text on the homepage (and the Coming
 * Soon page), one tab per section. Saved as JSON in
 * site_settings.homepage_text; the layout of the form comes from
 * HOMEPAGE_TEXT_SECTIONS in src/lib/homepage-text.js.
 */
export default function HomepageTextEditor() {
  const [values, setValues] = useState(null);
  const [savedJson, setSavedJson] = useState('');
  const [active, setActive] = useState(HOMEPAGE_TEXT_SECTIONS[0].key);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/site-settings', { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
        const settings = {};
        for (const s of json.settings || []) settings[s.key] = s.value ?? '';
        const text = homepageTextFromSettings(settings);
        if (!cancelled) {
          setValues(text);
          setSavedJson(JSON.stringify(text));
        }
      } catch (e) {
        if (!cancelled) setLoadError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = values !== null && JSON.stringify(values) !== savedJson;

  // Sections with unsaved edits get a dot on their tab.
  const changed = useMemo(() => {
    if (!values || !savedJson) return new Set();
    const saved = JSON.parse(savedJson);
    return new Set(
      HOMEPAGE_TEXT_SECTIONS.filter((s) => JSON.stringify(values[s.key]) !== JSON.stringify(saved[s.key])).map((s) => s.key)
    );
  }, [values, savedJson]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function save() {
    setSaving(true);
    try {
      const body = JSON.stringify({ updates: [{ key: HOMEPAGE_TEXT_KEY, value: JSON.stringify(values) }] });
      const res = await fetch('/api/admin/site-settings', {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setSavedJson(JSON.stringify(values));
      toast.success('Homepage text saved. The homepage shows it right away.');
    } catch (e) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  const section = HOMEPAGE_TEXT_SECTIONS.find((s) => s.key === active);
  const sectionValues = values?.[active];
  const setSection = (next) => setValues((v) => ({ ...v, [active]: next }));
  const setField = (key, value) => setSection({ ...sectionValues, [key]: value });

  function resetSection() {
    setSection(clone(HOMEPAGE_TEXT_DEFAULTS[active]));
    toast(`"${section.label}" is back to the original text. Click Save to keep it.`);
  }

  return (
    <>
      <Card
        title="Homepage text"
        description="Every heading and text on the homepage. Leave a field empty to hide that text. In texts: *word* = pink gradient, **words** = bold, Enter = new line."
        actions={
          <Button variant="accent" icon={Save} loading={saving} disabled={!dirty} onClick={save}>
            Save text
          </Button>
        }
      >
        {loadError ? (
          <Notice tone="error" title="Could not load the homepage text">{loadError}</Notice>
        ) : !values ? (
          <LoadingBlock className="py-10" />
        ) : (
          <div className="space-y-5">
            {/* Section tabs */}
            <div className="flex flex-wrap gap-2">
              {HOMEPAGE_TEXT_SECTIONS.map((s) => {
                const hidden = s.canHide && values[s.key]?.show === false;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setActive(s.key)}
                    className={cn(
                      'relative inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[13px] font-semibold border transition-colors',
                      active === s.key
                        ? 'bg-primary text-white border-primary shadow-pink'
                        : 'bg-white text-ink-700 border-ink-100 hover:border-ink-200 hover:bg-ink-50',
                      hidden && active !== s.key && 'text-ink-300 line-through'
                    )}
                  >
                    {s.label}
                    {changed.has(s.key) && (
                      <span
                        className={cn('h-1.5 w-1.5 rounded-full', active === s.key ? 'bg-white' : 'bg-primary')}
                        title="Unsaved changes"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active section */}
            <div className="rounded-2xl border border-ink-100 bg-ink-50/40 p-4 sm:p-5">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold text-ink-900">{section.label}</h3>
                  <p className="mt-0.5 text-[13px] text-ink-500 leading-relaxed">{section.description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {section.canHide && (
                    <Toggle
                      checked={sectionValues.show !== false}
                      onChange={(v) => setField('show', v)}
                      label={sectionValues.show !== false ? 'Shown on homepage' : 'Hidden'}
                    />
                  )}
                  <Button variant="secondary" size="sm" icon={RotateCcw} onClick={resetSection}>
                    Original text
                  </Button>
                </div>
              </div>

              <div className={cn('grid gap-4 sm:grid-cols-2', section.canHide && sectionValues.show === false && 'opacity-60')}>
                {section.fields.map((field) => (
                  <div key={field.key} className={field.half ? '' : 'sm:col-span-2'}>
                    {field.type === 'list' ? (
                      <ListField field={field} items={sectionValues[field.key] || []} onChange={(v) => setField(field.key, v)} />
                    ) : (
                      <TextField field={field} value={sectionValues[field.key] ?? ''} onChange={(v) => setField(field.key, v)} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {dirty && (
        <div className="fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-xl">
          <span className="text-[13px] font-semibold text-ink-700">Unsaved homepage text</span>
          <Button variant="ghost" size="sm" icon={Undo2} onClick={() => setValues(JSON.parse(savedJson))}>
            Undo
          </Button>
          <Button variant="accent" size="sm" icon={Save} loading={saving} onClick={save}>
            Save
          </Button>
        </div>
      )}
    </>
  );
}

function TextField({ field, value, onChange }) {
  if (field.type === 'image') {
    return <ImageField label={field.label} value={value} onChange={onChange} hint={field.hint} />;
  }
  return (
    <Field label={field.label} hint={field.hint}>
      {field.type === 'textarea' ? (
        <Textarea
          rows={field.rows || 3}
          className="min-h-0 resize-y"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.preview && value.trim() && (
        <div className="rounded-xl border border-dashed border-ink-100 bg-white px-3 py-2 text-[15px] font-extrabold leading-snug text-ink-900">
          {formatText(value)}
        </div>
      )}
    </Field>
  );
}

function ListField({ field, items, onChange }) {
  const blank = Object.fromEntries(field.fields.map((f) => [f.key, '']));
  const canAdd = !field.max || items.length < field.max;

  const update = (i, patch) => onChange(items.map((item, j) => (j === i ? { ...item, ...patch } : item)));
  const remove = (i) => onChange(items.filter((_, j) => j !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-bold uppercase tracking-wide text-ink-500">{field.label}</span>
        <span className="text-[12px] text-ink-300">
          {items.length}
          {field.max ? ` / ${field.max}` : ''}
        </span>
      </div>
      {field.hint && <p className="text-[12px] text-ink-300 leading-relaxed">{field.hint}</p>}

      {items.map((item, i) => (
        <div key={i} className="rounded-2xl border border-ink-100 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold uppercase tracking-wide text-ink-700">
              {field.itemLabel} {i + 1}
            </span>
            <div className="flex items-center gap-1">
              <IconButton icon={ArrowUp} label="Move up" disabled={i === 0} onClick={() => move(i, -1)} />
              <IconButton icon={ArrowDown} label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)} />
              <IconButton icon={Trash2} label="Remove" danger onClick={() => remove(i)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {field.fields.map((f) => (
              <div key={f.key} className={f.half ? '' : 'sm:col-span-2'}>
                <TextField field={f} value={item[f.key] ?? ''} onChange={(v) => update(i, { [f.key]: v })} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {canAdd && (
        <Button variant="secondary" size="sm" icon={Plus} onClick={() => onChange([...items, { ...blank }])}>
          Add {field.itemLabel.toLowerCase()}
        </Button>
      )}
    </div>
  );
}

function IconButton({ icon: Icon, label, onClick, disabled, danger }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
        danger ? 'text-red-500 hover:bg-red-50' : 'text-ink-500 hover:bg-ink-50 hover:text-ink-900'
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
