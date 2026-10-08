'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Home, Plus, Save, Trash2, Eye, EyeOff, ArrowUp, ArrowDown, Heading1, Type, ImageIcon,
  Columns2, Minus, Megaphone, LayoutGrid, Pencil, X, Upload, ExternalLink, WandSparkles,
  MonitorSmartphone, Code2,
} from 'lucide-react';
import 'react-quill-new/dist/quill.snow.css';
import {
  PageHeader, Card, Button, Field, Input, Textarea, Select, Toggle, Badge, Notice, LoadingBlock,
} from '@/components/admin/ui';
import { useModal } from '@/components/admin/AdminModal';
import HomepageBlocks from '@/components/HomepageBlocks';
import { cn } from '@/lib/utils';

const ReactQuill = dynamic(() => import('react-quill-new'), {
  ssr: false,
  loading: () => <div className="h-[180px] animate-pulse bg-ink-50" />,
});

/* ─── config ────────────────────────────────────────────────────────── */

const BLOCK_TYPES = [
  { type: 'heading', label: 'Heading', icon: Heading1, description: 'Section title with optional eyebrow and subtitle' },
  { type: 'rich-text', label: 'Rich text', icon: Type, description: 'Paragraphs, lists and links' },
  { type: 'image', label: 'Image', icon: ImageIcon, description: 'Single image with caption and optional credit' },
  { type: 'two-column', label: 'Two column', icon: Columns2, description: 'Text on one side, image on the other' },
  { type: 'visual-break', label: 'Visual break', icon: Minus, description: 'Wide image that separates two sections' },
  { type: 'cta-box', label: 'CTA box', icon: Megaphone, description: 'Highlighted message with an optional button' },
  { type: 'feature-grid', label: 'Feature grid', icon: LayoutGrid, description: 'Cards with image, title and text' },
];

const typeInfo = (type) => BLOCK_TYPES.find((t) => t.type === type);

// New-block content is public, so the placeholders are Swedish.
function defaultData(type) {
  switch (type) {
    case 'heading':
      return { eyebrow: '', title: 'Ny rubrik', subtitle: '', level: 'h2', align: 'center' };
    case 'rich-text':
      return { html: '<p>Skriv din text här.</p>' };
    case 'image':
      return { src: '', alt: '', caption: '', credit: '', maxHeight: 500, rounded: true };
    case 'two-column':
      return {
        html: '<h2>Rubrik</h2><p>Text på ena sidan, bild på den andra.</p>',
        imageSrc: '',
        imageAlt: '',
        imageCaption: '',
        reverse: false,
      };
    case 'visual-break':
      return { src: '', alt: '', credit: '', height: 400 };
    case 'cta-box':
      return { variant: 'accent', heading: 'Rubrik', text: 'Ditt budskap här.', buttonText: '', buttonHref: '' };
    case 'feature-grid':
      return { title: '', columns: 3, items: [{ title: 'Kort ett', description: '<p>Kort beskrivning.</p>', image: '' }] };
    default:
      return {};
  }
}

const HERO_KEYS = ['hero_eyebrow', 'hero_title', 'hero_subtitle'];
const EMPTY_HERO = { hero_eyebrow: '', hero_title: '', hero_subtitle: '' };
// What the homepage shows when a hero field is left empty (see src/components/Hero.js).
const HERO_DEFAULTS = {
  hero_eyebrow: 'Byggd av föräldrar, för föräldrar',
  hero_title: 'Vill du veta vad familjer *nära dig* hittar på?',
  hero_subtitle: 'Aktiviteter, event och skoj. Tillsammans. Delat av familjer i närheten.',
};

/** "*word*" → pink gradient, same rule as the public Hero. */
function heroTitle(title) {
  return title.split(/(\*[^*]+\*)/g).map((part, i) =>
    part.startsWith('*') && part.endsWith('*') && part.length > 2 ? (
      <span key={i} className="text-brand-gradient">{part.slice(1, -1)}</span>
    ) : (
      part
    )
  );
}

const QUILL_MODULES = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'blockquote'],
    ['clean'],
  ],
};
const QUILL_FORMATS = ['header', 'bold', 'italic', 'underline', 'list', 'link', 'blockquote'];

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

const textOf = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function blockSummary(block) {
  const d = block.data || {};
  switch (block.block_type) {
    case 'heading':
      return d.title || d.eyebrow || '(empty heading)';
    case 'rich-text': {
      const t = textOf(d.html);
      return t ? t.slice(0, 110) + (t.length > 110 ? '…' : '') : '(empty text)';
    }
    case 'image':
    case 'visual-break':
      return d.alt || d.src || '(no image yet)';
    case 'two-column':
      return [textOf(d.html).slice(0, 70), d.imageSrc ? '+ image' : '(no image)'].filter(Boolean).join(' ');
    case 'cta-box':
      return `${d.variant || 'accent'} · ${d.heading || d.text || ''}`.slice(0, 110);
    case 'feature-grid': {
      const n = Array.isArray(d.items) ? d.items.length : 0;
      return `${d.title ? d.title + ' · ' : ''}${n} card${n === 1 ? '' : 's'} · ${d.columns || 3} columns`;
    }
    default:
      return '';
  }
}

/** Mirrors the "render nothing" rules in HomepageBlocks so the preview can say why it is blank. */
function isBlockEmpty(block) {
  const d = block.data || {};
  switch (block.block_type) {
    case 'heading':
      return !d.title && !d.eyebrow && !d.subtitle;
    case 'rich-text':
      return !textOf(d.html) && !/<(img|iframe|video|table|hr)\b/i.test(d.html || '');
    case 'image':
    case 'visual-break':
      return !String(d.src || '').trim();
    case 'two-column':
      return !String(d.imageSrc || '').trim() && !textOf(d.html);
    case 'cta-box':
      return !d.heading && !d.text && !(d.buttonText && d.buttonHref);
    case 'feature-grid':
      return !(d.items || []).some((i) => i && (i.title || i.image || textOf(i.description)));
    default:
      return true;
  }
}

/**
 * Quill 2's getSemanticHTML() turns every space into &nbsp; (no line
 * wrapping) and gives every link target="_blank"; keep internal links
 * (/path, #anchor) in the same tab.
 */
function cleanQuillHtml(html) {
  const out = String(html || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/<a\s([^>]*)>/gi, (tag, attrs) => {
      const href = /href="([^"]*)"/i.exec(attrs)?.[1] || '';
      if (!/^(\/(?!\/)|#)/.test(href)) return tag;
      return `<a ${attrs.replace(/\s*(target|rel)="[^"]*"/gi, '').trim()}>`;
    });
  return out === '<p></p>' || out === '<p><br></p>' ? '' : out;
}

// Markup the visual editor can't represent; editing it there would strip it.
const looksCustom = (html) =>
  /<(table|div|iframe|figure|img|section|span|h1|h4|h5|h6|pre|code|video|button|svg)\b|\s(class|style)=/i.test(html || '');

/* ─── page ──────────────────────────────────────────────────────────── */

export default function HomepageAdminPage() {
  const { showConfirm } = useModal();

  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null); // { block, snapshot, isNew, afterId }
  const [savingBlock, setSavingBlock] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [previewHidden, setPreviewHidden] = useState(false);

  const loadBlocks = useCallback(async () => {
    try {
      const json = await api('/api/admin/homepage-blocks');
      setBlocks(json.blocks || []);
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  function openEditor(block, isNew = false) {
    const copy = JSON.parse(JSON.stringify(block));
    setEditing({ block: copy, snapshot: JSON.stringify(copy), isNew, afterId: isNew ? selectedId : null });
  }

  function startNewBlock(type) {
    setShowAdd(false);
    openEditor({ id: null, block_type: type, data: defaultData(type), visible: true }, true);
  }

  async function closeEditor() {
    if (!editing || savingBlock) return;
    if (JSON.stringify(editing.block) !== editing.snapshot) {
      const ok = await showConfirm(
        editing.isNew ? 'Discard new block?' : 'Discard changes?',
        editing.isNew ? 'The block has not been added to the homepage yet.' : 'Your unsaved edits to this block will be lost.',
        'warning',
        { confirmText: 'Discard' }
      );
      if (!ok) return;
    }
    setEditing(null);
  }

  async function saveEditing() {
    if (!editing) return;
    const { block, isNew, afterId } = editing;
    setSavingBlock(true);
    try {
      if (isNew) {
        const json = await api('/api/admin/homepage-blocks', {
          method: 'POST',
          body: JSON.stringify({
            block_type: block.block_type,
            data: block.data,
            visible: block.visible,
            after_id: afterId || undefined,
          }),
        });
        setSelectedId(json.block?.id ?? null);
      } else {
        await api('/api/admin/homepage-blocks', {
          method: 'PATCH',
          body: JSON.stringify({ id: block.id, data: block.data, visible: block.visible }),
        });
      }
      setEditing(null);
      toast.success(isNew ? 'Block added' : 'Block saved');
      await loadBlocks();
    } catch (e) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setSavingBlock(false);
    }
  }

  async function move(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
    try {
      await api('/api/admin/homepage-blocks', { method: 'PATCH', body: JSON.stringify({ order: next.map((b) => b.id) }) });
    } catch (e) {
      toast.error(`Reorder failed: ${e.message}`);
      loadBlocks();
    }
  }

  async function toggleVisible(block) {
    const visible = !block.visible;
    setBlocks((list) => list.map((b) => (b.id === block.id ? { ...b, visible } : b)));
    try {
      await api('/api/admin/homepage-blocks', { method: 'PATCH', body: JSON.stringify({ id: block.id, visible }) });
      toast.success(visible ? 'Block is now live on the homepage' : 'Block hidden from the homepage');
    } catch (e) {
      toast.error(`Update failed: ${e.message}`);
      loadBlocks();
    }
  }

  async function deleteBlock(block) {
    const label = typeInfo(block.block_type)?.label || 'block';
    const ok = await showConfirm(`Delete this ${label.toLowerCase()} block?`, 'This cannot be undone.', 'danger');
    if (!ok) return;
    try {
      await api(`/api/admin/homepage-blocks?id=${encodeURIComponent(block.id)}`, { method: 'DELETE' });
      if (selectedId === block.id) setSelectedId(null);
      toast.success('Block deleted');
      await loadBlocks();
    } catch (e) {
      toast.error(`Delete failed: ${e.message}`);
    }
  }

  async function loadStarter() {
    const ok = await showConfirm(
      'Load starter blocks?',
      'Adds 3 example blocks (heading, feature grid and CTA) in Swedish. They are added as hidden drafts, so nothing changes on the live site until you show them.',
      'info',
      { confirmText: 'Add blocks' }
    );
    if (!ok) return;
    setSeeding(true);
    try {
      const json = await api('/api/admin/homepage-blocks?seed=1', { method: 'POST' });
      setPreviewHidden(true);
      toast.success(`Added ${json.blocks?.length ?? 0} draft blocks`);
      await loadBlocks();
    } catch (e) {
      toast.error(`Could not load starter blocks: ${e.message}`);
    } finally {
      setSeeding(false);
    }
  }

  const visibleCount = blocks.filter((b) => b.visible).length;
  const previewBlocks = previewHidden ? blocks : blocks.filter((b) => b.visible);
  const editingInfo = editing ? typeInfo(editing.block.block_type) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Home}
        title="Homepage"
        description="Edit the hero text and build extra homepage sections from blocks. Blocks render on the homepage in the order shown below."
        actions={
          <>
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center justify-center gap-2 h-10 px-4 text-[13px] font-semibold rounded-xl bg-white text-ink-700 border border-ink-100 hover:border-ink-200 hover:bg-ink-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> View homepage
            </Link>
            <Button variant="accent" icon={Plus} onClick={() => setShowAdd(true)}>
              Add block
            </Button>
          </>
        }
      />

      <HeroEditor />

      <Card
        title="Content blocks"
        description={
          blocks.length > 0
            ? `${blocks.length} block${blocks.length === 1 ? '' : 's'}, ${visibleCount} visible. Click a block to select it; new blocks are inserted after the selected one.`
            : 'Extra sections shown on the homepage, in this order.'
        }
        actions={
          blocks.length > 0 && (
            <Button variant="secondary" size="sm" icon={Plus} onClick={() => setShowAdd(true)}>
              {selectedId ? 'Add after selected' : 'Add block'}
            </Button>
          )
        }
      >
        {loading ? (
          <LoadingBlock label="Loading blocks…" />
        ) : loadError ? (
          <Notice tone="error" title="Could not load homepage blocks">
            {loadError}
          </Notice>
        ) : blocks.length === 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-brand-gradient-soft p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-pink">
                  <WandSparkles className="w-5 h-5" />
                </div>
                <Badge tone="pink">Recommended</Badge>
              </div>
              <h3 className="text-lg font-black text-ink-900 mb-1.5">Load starter blocks</h3>
              <p className="text-[13px] text-ink-500 leading-relaxed mb-5">
                Three example blocks in Swedish (heading, feature grid and CTA) in the Famies style. They arrive as hidden
                drafts you can edit before publishing.
              </p>
              <Button variant="accent" icon={WandSparkles} loading={seeding} onClick={loadStarter}>
                Load starter blocks
              </Button>
            </div>
            <div className="rounded-2xl border-2 border-dashed border-ink-100 p-6">
              <div className="w-10 h-10 rounded-xl bg-ink-50 text-ink-500 flex items-center justify-center mb-4">
                <Plus className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-ink-900 mb-1.5">Start from scratch</h3>
              <p className="text-[13px] text-ink-500 leading-relaxed mb-5">
                Build your own sections block by block: headings, text, images, CTAs and feature grids.
              </p>
              <Button variant="secondary" icon={Plus} onClick={() => setShowAdd(true)}>
                Add your first block
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {blocks.map((block, i) => {
              const info = typeInfo(block.block_type);
              const Icon = info?.icon || Type;
              const selected = selectedId === block.id;
              return (
                <div
                  key={block.id}
                  onClick={(e) => {
                    if (e.target.closest('button')) return;
                    setSelectedId(selected ? null : block.id);
                  }}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition',
                    selected ? 'border-primary bg-primary-50 ring-2 ring-primary/20' : 'border-ink-100 bg-white hover:border-ink-200',
                    !block.visible && !selected && 'bg-ink-50'
                  )}
                >
                  <div className="flex flex-col">
                    <IconButton title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="w-3.5 h-3.5" />
                    </IconButton>
                    <IconButton title="Move down" disabled={i === blocks.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown className="w-3.5 h-3.5" />
                    </IconButton>
                  </div>

                  <div
                    className={cn(
                      'w-10 h-10 shrink-0 rounded-xl flex items-center justify-center',
                      block.visible ? 'bg-primary/15 text-primary-700' : 'bg-ink-100 text-ink-500'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[13px] font-bold text-ink-900">{info?.label || block.block_type}</span>
                      <span className="text-[11px] font-semibold text-ink-300">#{i + 1}</span>
                      {!block.visible && <Badge tone="gray">Hidden</Badge>}
                      {selected && <Badge tone="pink">Selected</Badge>}
                    </div>
                    <p className={cn('mt-0.5 text-[12px] truncate', block.visible ? 'text-ink-500' : 'text-ink-300')}>
                      {blockSummary(block)}
                    </p>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <IconButton
                      title={block.visible ? 'Hide from homepage' : 'Show on homepage'}
                      onClick={() => toggleVisible(block)}
                      className={block.visible ? 'text-emerald-600 hover:bg-emerald-50' : undefined}
                    >
                      {block.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </IconButton>
                    <IconButton title="Edit" onClick={() => openEditor(block)}>
                      <Pencil className="w-4 h-4" />
                    </IconButton>
                    <IconButton title="Delete" onClick={() => deleteBlock(block)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </IconButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {blocks.length > 0 && (
        <Card
          title="Live preview"
          description="How the blocks render on the homepage (scaled down)."
          actions={<Toggle checked={previewHidden} onChange={setPreviewHidden} label="Include hidden blocks" />}
        >
          <PreviewFrame
            blocks={previewBlocks}
            zoom={0.7}
            emptyText={previewHidden ? 'No block has content to show yet.' : 'No visible blocks. Turn on “Include hidden blocks” to preview drafts.'}
          />
        </Card>
      )}

      {/* Add block picker */}
      {showAdd && (
        <Dialog
          title={selectedId ? 'Add a block after the selected one' : 'Add a block'}
          subtitle="Pick a block type. You can edit it before it is added."
          onClose={() => setShowAdd(false)}
          size="lg"
        >
          <div className="grid sm:grid-cols-2 gap-3 p-5">
            {BLOCK_TYPES.map(({ type, label, icon: Icon, description }) => (
              <button
                key={type}
                type="button"
                onClick={() => startNewBlock(type)}
                className="text-left p-4 rounded-xl border border-ink-100 bg-white hover:border-primary hover:bg-primary-50 transition-colors"
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary-700 flex items-center justify-center">
                    <Icon className="w-[18px] h-[18px]" />
                  </div>
                  <p className="text-[13px] font-bold text-ink-900">{label}</p>
                </div>
                <p className="text-[12px] text-ink-500 leading-relaxed">{description}</p>
              </button>
            ))}
          </div>
        </Dialog>
      )}

      {/* Block editor */}
      {editing && (
        <Dialog
          title={`${editing.isNew ? 'New' : 'Edit'} ${editingInfo?.label.toLowerCase() || 'block'}`}
          subtitle={editingInfo?.description}
          onClose={closeEditor}
          size="xl"
          footer={
            <>
              <Button variant="secondary" onClick={closeEditor} disabled={savingBlock}>
                Cancel
              </Button>
              <Button variant="accent" icon={Save} loading={savingBlock} onClick={saveEditing}>
                {editing.isNew ? 'Add block' : 'Save changes'}
              </Button>
            </>
          }
        >
          <div className="grid xl:grid-cols-[minmax(0,500px)_minmax(0,1fr)] xl:h-full">
            <div className="p-5 space-y-4 xl:overflow-y-auto xl:border-r border-ink-100">
              <BlockForm block={editing.block} onChange={(block) => setEditing((ed) => ({ ...ed, block }))} />
              <div className="pt-4 border-t border-ink-100">
                <Toggle
                  checked={!!editing.block.visible}
                  onChange={(visible) => setEditing((ed) => ({ ...ed, block: { ...ed.block, visible } }))}
                  label="Visible on the homepage"
                />
              </div>
            </div>
            <div className="p-4 bg-ink-50 border-t xl:border-t-0 border-ink-100 xl:overflow-y-auto">
              <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                <MonitorSmartphone className="w-3.5 h-3.5" /> Live preview
              </p>
              <PreviewFrame blocks={[editing.block]} zoom={0.75} emptyText="Fill in the fields to see a preview." />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

/* ─── hero text ─────────────────────────────────────────────────────── */

function HeroEditor() {
  const [values, setValues] = useState(EMPTY_HERO);
  const [original, setOriginal] = useState(EMPTY_HERO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // All settings (not ?group=hero): keys created by an upsert land in
        // the default 'general' group.
        const json = await api('/api/admin/site-settings');
        const map = {};
        for (const s of json.settings || []) map[s.key] = s.value ?? '';
        const next = Object.fromEntries(HERO_KEYS.map((k) => [k, map[k] ?? '']));
        if (!cancelled) {
          setValues(next);
          setOriginal(next);
        }
      } catch (e) {
        if (!cancelled) toast.error(`Could not load hero text: ${e.message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = HERO_KEYS.some((k) => values[k] !== original[k]);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function save() {
    setSaving(true);
    try {
      await api('/api/admin/site-settings', {
        method: 'PUT',
        body: JSON.stringify({ updates: HERO_KEYS.map((key) => ({ key, value: values[key] })) }),
      });
      setOriginal(values);
      toast.success('Hero text saved');
    } catch (e) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Hero section"
      description="The badge, headline (H1) and paragraph at the very top of the homepage."
      actions={
        <Button variant="accent" icon={Save} loading={saving} disabled={!dirty || loading} onClick={save}>
          Save hero text
        </Button>
      }
    >
      {loading ? (
        <LoadingBlock className="py-10" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label="Eyebrow badge" hint="Small pill above the headline. Empty = the built-in text.">
              <Input value={values.hero_eyebrow} onChange={set('hero_eyebrow')} placeholder={HERO_DEFAULTS.hero_eyebrow} />
            </Field>
            <Field label="Title (H1)" hint={`${values.hero_title.length} characters, ideally under 70. Wrap words in *stars* for the pink gradient. Empty = the built-in headline.`}>
              <Textarea
                rows={2}
                value={values.hero_title}
                onChange={set('hero_title')}
                className="min-h-0 text-base font-semibold resize-y"
                placeholder={HERO_DEFAULTS.hero_title}
              />
            </Field>
            <Field label="Subtitle" hint={`${values.hero_subtitle.length} characters. One to three sentences works best. Empty = the built-in text.`}>
              <Textarea rows={4} value={values.hero_subtitle} onChange={set('hero_subtitle')} className="min-h-0 resize-y" placeholder={HERO_DEFAULTS.hero_subtitle} />
            </Field>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-ink-100 bg-brand-gradient-soft p-6 sm:p-8 flex flex-col justify-center min-h-[240px]">
            <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-primary/25 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-12 w-56 h-56 rounded-full bg-secondary/40 blur-3xl pointer-events-none" />
            <p className="relative mb-4 text-[10px] font-bold uppercase tracking-wider text-ink-300">Preview</p>
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 rounded-full glass shadow-soft">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-700">
                  {values.hero_eyebrow.trim() || HERO_DEFAULTS.hero_eyebrow}
                </span>
              </div>
              <p className="text-2xl sm:text-[2rem] font-black tracking-tight leading-[1.05] text-ink-900 mb-3 whitespace-pre-line">
                {heroTitle(values.hero_title.trim() || HERO_DEFAULTS.hero_title)}
              </p>
              <p className="text-sm text-ink-500 leading-relaxed font-medium whitespace-pre-line">
                {values.hero_subtitle.trim() || HERO_DEFAULTS.hero_subtitle}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ─── block forms ───────────────────────────────────────────────────── */

function BlockForm({ block, onChange }) {
  const d = block.data || {};
  const set = (key, value) => onChange({ ...block, data: { ...d, [key]: value } });
  const text = (key) => (e) => set(key, e.target.value);
  const num = (key) => (e) => set(key, e.target.value === '' ? '' : Number(e.target.value));

  switch (block.block_type) {
    case 'heading':
      return (
        <div className="space-y-4">
          <Field label="Eyebrow (optional)" hint="Small uppercase pill above the title.">
            <Input value={d.eyebrow || ''} onChange={text('eyebrow')} placeholder="Inspiration" />
          </Field>
          <Field label="Title">
            <Input value={d.title || ''} onChange={text('title')} />
          </Field>
          <Field label="Subtitle (optional)">
            <Textarea rows={3} className="min-h-0" value={d.subtitle || ''} onChange={text('subtitle')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Size">
              <Select value={d.level || 'h2'} onChange={text('level')}>
                <option value="h2">H2 (large)</option>
                <option value="h3">H3 (medium)</option>
              </Select>
            </Field>
            <Field label="Alignment">
              <Select value={d.align || 'center'} onChange={text('align')}>
                <option value="center">Center</option>
                <option value="left">Left</option>
              </Select>
            </Field>
          </div>
        </div>
      );

    case 'rich-text':
      return (
        <Field label="Content">
          <HtmlEditor value={d.html || ''} onChange={(html) => set('html', html)} />
        </Field>
      );

    case 'image':
      return (
        <div className="space-y-4">
          <ImageField label="Image" value={d.src || ''} onChange={(v) => set('src', v)} />
          <Field label="Alt text" hint="Describe the image, in Swedish. Important for SEO and screen readers.">
            <Input value={d.alt || ''} onChange={text('alt')} />
          </Field>
          <Field label="Caption (optional)" hint="Shown under the image.">
            <Input value={d.caption || ''} onChange={text('caption')} />
          </Field>
          <Field label="Credit (optional)" hint="Small overlay text on the image.">
            <Input value={d.credit || ''} onChange={text('credit')} placeholder="Foto: Namn" />
          </Field>
          <div className="grid grid-cols-2 gap-3 items-end">
            <Field label="Max height (px)">
              <Input type="number" min={120} max={1600} value={d.maxHeight ?? 500} onChange={num('maxHeight')} />
            </Field>
            <Toggle className="h-10" checked={d.rounded !== false} onChange={(v) => set('rounded', v)} label="Rounded corners" />
          </div>
        </div>
      );

    case 'two-column':
      return (
        <div className="space-y-4">
          <Field label="Text">
            <HtmlEditor value={d.html || ''} onChange={(html) => set('html', html)} />
          </Field>
          <ImageField label="Image" value={d.imageSrc || ''} onChange={(v) => set('imageSrc', v)} />
          <Field label="Image alt text">
            <Input value={d.imageAlt || ''} onChange={text('imageAlt')} />
          </Field>
          <Field label="Image caption (optional)">
            <Input value={d.imageCaption || ''} onChange={text('imageCaption')} />
          </Field>
          <Toggle checked={!!d.reverse} onChange={(v) => set('reverse', v)} label="Put the image on the left" />
        </div>
      );

    case 'visual-break':
      return (
        <div className="space-y-4">
          <ImageField label="Image" value={d.src || ''} onChange={(v) => set('src', v)} hint="A wide landscape photo works best." />
          <Field label="Alt text">
            <Input value={d.alt || ''} onChange={text('alt')} />
          </Field>
          <Field label="Credit (optional)" hint="Small overlay text on the image.">
            <Input value={d.credit || ''} onChange={text('credit')} />
          </Field>
          <Field label="Max height (px)">
            <Input type="number" min={120} max={1200} value={d.height ?? 400} onChange={num('height')} />
          </Field>
        </div>
      );

    case 'cta-box':
      return (
        <div className="space-y-4">
          <Field label="Style">
            <Select value={d.variant || 'accent'} onChange={text('variant')}>
              <option value="accent">Famies pink (accent)</option>
              <option value="info">Soft glass (info)</option>
              <option value="success">Mint (success)</option>
              <option value="warning">Amber (warning)</option>
              <option value="danger">Red (danger)</option>
            </Select>
          </Field>
          <Field label="Heading">
            <Input value={d.heading || ''} onChange={text('heading')} />
          </Field>
          <Field label="Text">
            <Textarea rows={4} value={d.text || ''} onChange={text('text')} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Button text (optional)">
              <Input value={d.buttonText || ''} onChange={text('buttonText')} placeholder="Ladda ner appen" />
            </Field>
            <Field label="Button link">
              <Input value={d.buttonHref || ''} onChange={text('buttonHref')} placeholder="/#download" />
            </Field>
          </div>
          <p className="text-[12px] text-ink-300 leading-relaxed">
            The button shows only when both fields are filled. Use a path like /inspiration or /#download, or a full URL
            (external links open in a new tab).
          </p>
        </div>
      );

    case 'feature-grid':
      return <FeatureGridForm data={d} onChange={(data) => onChange({ ...block, data })} />;

    default:
      return <Notice tone="warning">Unknown block type “{block.block_type}”.</Notice>;
  }
}

function FeatureGridForm({ data, onChange }) {
  const items = Array.isArray(data.items) ? data.items : [];
  // Bumped on reorder/remove so each card's (uncontrolled) editor remounts
  // with the right content.
  const [version, setVersion] = useState(0);

  const setItems = (next) => onChange({ ...data, items: next });
  const updateItem = (i, patch) => setItems(items.map((item, j) => (j === i ? { ...item, ...patch } : item)));
  const addItem = () => setItems([...items, { title: 'Nytt kort', description: '', image: '' }]);
  const removeItem = (i) => {
    setItems(items.filter((_, j) => j !== i));
    setVersion((v) => v + 1);
  };
  const moveItem = (i, dir) => {
    const t = i + dir;
    if (t < 0 || t >= items.length) return;
    const next = [...items];
    [next[i], next[t]] = [next[t], next[i]];
    setItems(next);
    setVersion((v) => v + 1);
  };

  return (
    <div className="space-y-4">
      <Field label="Grid title (optional)">
        <Input value={data.title || ''} onChange={(e) => onChange({ ...data, title: e.target.value })} />
      </Field>
      <Field label="Columns on desktop">
        <Select value={data.columns || 3} onChange={(e) => onChange({ ...data, columns: Number(e.target.value) })}>
          <option value={2}>2 columns</option>
          <option value={3}>3 columns</option>
          <option value={4}>4 columns</option>
        </Select>
      </Field>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold uppercase tracking-wide text-ink-500">Cards ({items.length})</span>
          <Button size="sm" variant="secondary" icon={Plus} onClick={addItem}>
            Add card
          </Button>
        </div>

        {items.map((item, i) => (
          <div key={`${version}-${i}`} className="rounded-xl border border-ink-100 bg-ink-50/60 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-ink-700">Card {i + 1}</span>
              <div className="flex items-center gap-0.5">
                <IconButton title="Move up" disabled={i === 0} onClick={() => moveItem(i, -1)}>
                  <ArrowUp className="w-3.5 h-3.5" />
                </IconButton>
                <IconButton title="Move down" disabled={i === items.length - 1} onClick={() => moveItem(i, 1)}>
                  <ArrowDown className="w-3.5 h-3.5" />
                </IconButton>
                <IconButton title="Remove card" onClick={() => removeItem(i)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </IconButton>
              </div>
            </div>
            <Input placeholder="Title" value={item.title || ''} onChange={(e) => updateItem(i, { title: e.target.value })} />
            <HtmlEditor compact value={item.description || ''} onChange={(html) => updateItem(i, { description: html })} />
            <ImageField label="Image (optional)" value={item.image || ''} onChange={(v) => updateItem(i, { image: v })} />
          </div>
        ))}

        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-ink-200 py-6 text-center text-[13px] text-ink-500">No cards yet.</p>
        )}
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

function Dialog({ title, subtitle, onClose, footer, size = 'md', children }) {
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
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'w-full max-h-[94vh] flex flex-col rounded-2xl bg-white border border-ink-100 shadow-2xl',
          size === 'xl' ? 'max-w-[1400px] xl:h-[94vh]' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl'
        )}
      >
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-ink-100">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-ink-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12px] text-ink-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-ink-300 hover:text-ink-900 hover:bg-ink-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className={cn('flex-1 min-h-0 overflow-y-auto', size === 'xl' && 'xl:overflow-hidden')}>{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 px-5 py-4 border-t border-ink-100">{footer}</footer>}
      </div>
    </div>
  );
}

function PreviewFrame({ blocks, zoom = 0.75, emptyText }) {
  const renderable = blocks.filter((b) => !isBlockEmpty(b));
  if (renderable.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-200 bg-white py-12 px-6 text-center text-[13px] text-ink-500">
        {emptyText}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-ink-100 overflow-hidden bg-white">
      <div className="bg-brand-gradient-soft" style={{ zoom }}>
        <HomepageBlocks blocks={renderable} />
      </div>
    </div>
  );
}

/** Visual (Quill) / raw HTML editor. Quill is uncontrolled: it only reports user edits. */
function HtmlEditor({ value, onChange, compact = false }) {
  const [mode, setMode] = useState(() => (looksCustom(value) ? 'html' : 'visual'));
  const custom = looksCustom(value);

  return (
    <div className="rounded-xl border border-ink-100 bg-white overflow-hidden focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition">
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 border-b border-ink-100 bg-ink-50">
        <div className="inline-flex rounded-lg border border-ink-100 bg-white p-0.5">
          {[
            ['visual', 'Visual', Type],
            ['html', 'HTML', Code2],
          ].map(([m, label, Icon]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors',
                mode === m ? 'bg-ink-900 text-white' : 'text-ink-500 hover:text-ink-900'
              )}
            >
              <Icon className="w-3 h-3" /> {label}
            </button>
          ))}
        </div>
        {mode === 'visual' && custom && (
          <span className="text-[11px] font-semibold text-amber-700">Custom HTML detected: edit in HTML mode to keep it.</span>
        )}
      </div>

      {mode === 'visual' ? (
        <div
          className={cn(
            '[&_.ql-toolbar.ql-snow]:!border-x-0 [&_.ql-toolbar.ql-snow]:!border-t-0 [&_.ql-toolbar.ql-snow]:!border-ink-100',
            '[&_.ql-container.ql-snow]:!border-0 [&_.ql-container]:!font-sans [&_.ql-container]:!text-sm',
            compact ? '[&_.ql-editor]:min-h-[110px]' : '[&_.ql-editor]:min-h-[200px]'
          )}
        >
          <ReactQuill
            theme="snow"
            defaultValue={value}
            modules={QUILL_MODULES}
            formats={QUILL_FORMATS}
            onChange={(html, _delta, source) => {
              if (source === 'user') onChange(cleanQuillHtml(html));
            }}
          />
        </div>
      ) : (
        <Textarea
          mono
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn('rounded-none border-0 focus:ring-0', compact ? 'min-h-[130px]' : 'min-h-[240px]')}
          placeholder="<p>…</p>"
        />
      )}
    </div>
  );
}

/** URL input + upload (POST /api/admin/upload → { url }) + thumbnail. */
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
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… or /bild.webp" />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <Button variant="secondary" icon={Upload} loading={uploading} onClick={() => fileRef.current?.click()}>
          Upload
        </Button>
      </div>
      {value && (
        <div className="mt-2 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-16 w-24 rounded-lg border border-ink-100 object-cover bg-ink-50" />
          <button type="button" onClick={() => onChange('')} className="text-[12px] font-semibold text-red-500 hover:text-red-600">
            Remove image
          </button>
        </div>
      )}
    </Field>
  );
}
