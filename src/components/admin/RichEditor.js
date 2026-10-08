'use client';
/**
 * Lightweight WYSIWYG editor for article HTML (contentEditable +
 * execCommand), ported from the mushroomidentifiers.com admin.
 *
 *   <RichEditor value={html} onChange={setHtml} resetKey={n} />
 *
 * - The DOM is the source of truth while typing; a MutationObserver pushes
 *   every change up through `onChange`. `value` only seeds the DOM on mount,
 *   when switching back from HTML view, and whenever `resetKey` changes —
 *   bump it after changing `value` from outside (e.g. Interlink Checker).
 * - Visual ⇄ HTML toggle for pasting / tweaking raw markup.
 * - Click an image for alt text, drag-resize, align and delete; click a
 *   link to edit, open or remove it.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Heading2, Heading3, Heading4, Link as LinkIcon, Image as ImageIcon,
  AlignLeft, AlignCenter, AlignRight, Quote, Code, Minus,
  Upload, Undo2, Redo2, Pilcrow, Table, RemoveFormatting,
  Trash2, X, GripVertical, Pencil, Unlink, ExternalLink,
  FileCode2, Eye, Loader2,
} from 'lucide-react';
import { useModal } from '@/components/admin/AdminModal';
import { cn } from '@/lib/utils';

// Marks the currently selected image. Stripped from every HTML read so the
// selection outline is never saved into the article.
const SELECTED_ATTR = 'data-rte-selected';
const SELECTED_ATTR_RE = /\sdata-rte-selected(="[^"]*")?/g;

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml';

const CONTENT_CLASSES = [
  '[&_h1]:text-3xl [&_h1]:font-black [&_h1]:mt-6 [&_h1]:mb-3',
  '[&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:mt-6 [&_h2]:mb-3',
  '[&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-5 [&_h3]:mb-2',
  '[&_h4]:text-lg [&_h4]:font-bold [&_h4]:mt-4 [&_h4]:mb-2',
  '[&_p]:mb-3 [&_p]:leading-relaxed',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3 [&_li]:mb-1',
  '[&_a]:text-primary-700 [&_a]:underline [&_a]:underline-offset-2',
  '[&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-ink-500 [&_blockquote]:my-4',
  '[&_pre]:bg-ink-50 [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:text-[13px] [&_pre]:font-mono [&_pre]:my-4 [&_pre]:whitespace-pre-wrap',
  '[&_code]:bg-ink-50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] [&_code]:font-mono',
  '[&_img]:rounded-xl [&_img]:max-w-full [&_img]:h-auto [&_img]:my-4 [&_img]:cursor-pointer',
  '[&_hr]:my-6 [&_hr]:border-ink-100',
  '[&_table]:w-full [&_table]:border-collapse [&_table]:my-4',
  '[&_th]:border [&_th]:border-ink-200 [&_th]:bg-primary-50 [&_th]:p-2 [&_th]:text-left [&_th]:font-bold',
  '[&_td]:border [&_td]:border-ink-200 [&_td]:p-2',
  '[&_strong]:font-bold [&_b]:font-bold [&_em]:italic',
].join(' ');

// ── helpers ───────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Trimmed URL, or '' when it uses a script-capable scheme. */
function safeUrl(url, { allowDataImage = false } = {}) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^(javascript|vbscript):/i.test(u)) return '';
  if (/^data:/i.test(u) && !(allowDataImage && /^data:image\//i.test(u))) return '';
  return u;
}

function cleanHtml(el) {
  return el ? el.innerHTML.replace(SELECTED_ATTR_RE, '') : '';
}

/** Position of `el` inside the scroll box, in the box's content coordinates. */
function positionIn(box, el) {
  if (!box || !el) return null;
  const b = box.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return {
    top: r.bottom - b.top + box.scrollTop,
    left: Math.max(0, r.left - b.left + box.scrollLeft),
    width: r.width,
    boxWidth: box.clientWidth,
  };
}

function imageHtml(src, alt) {
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" style="max-width:100%;height:auto;border-radius:12px;margin:16px 0;" />`;
}

function ToolBtn({ onAction, title, active, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active ? true : undefined}
      onMouseDown={(e) => {
        e.preventDefault();
        onAction();
      }}
      className={cn(
        'p-1.5 rounded-md transition-colors',
        active ? 'bg-primary/15 text-primary-700 ring-1 ring-primary/30' : 'text-ink-500 hover:text-ink-900 hover:bg-ink-100'
      )}
    >
      {children}
    </button>
  );
}

function ToolDivider() {
  return <div className="w-px h-6 mx-1 bg-ink-100" />;
}

// ── component ─────────────────────────────────────────────────

export default function RichEditor({ value, onChange, resetKey, placeholder = 'Start writing…' }) {
  const { showPrompt, showAlert } = useModal();

  const boxRef = useRef(null); // scroll container (positioning context)
  const toolbarRef = useRef(null);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const imgToolbarRef = useRef(null);
  const linkToolbarRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const initializedRef = useRef(false);
  const lastResetKeyRef = useRef(resetKey);
  const savedSelectionRef = useRef(null);
  const selectedImgRef = useRef(null);
  const selectedLinkRef = useRef(null);
  const resizeStartRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [activeFormats, setActiveFormats] = useState(() => new Set());
  // WordPress-style Visual ⇄ HTML toggle.
  const [viewMode, setViewMode] = useState('visual');
  // Floating toolbars: { top, left, width, boxWidth } / { top, left, href }
  const [imgUi, setImgUi] = useState(null);
  const [imgAlt, setImgAlt] = useState('');
  const [linkUi, setLinkUi] = useState(null);

  // Keep the callback fresh without re-subscribing the observer.
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Seed the DOM from `value` once (and again after coming back from HTML
  // view). An empty value doesn't lock initialisation, so content loaded
  // later still gets seeded — and when the DOM already equals `value`
  // (the user just typed it) nothing is touched, so the caret stays put.
  useEffect(() => {
    if (viewMode !== 'visual' || initializedRef.current) return;
    const el = editorRef.current;
    if (!el) return;
    const html = value || '';
    if (cleanHtml(el) !== html) el.innerHTML = html;
    if (html) initializedRef.current = true;
  }, [value, viewMode]);

  // External content change (resetKey bumped) → re-seed the live DOM.
  useEffect(() => {
    if (lastResetKeyRef.current === resetKey) return;
    lastResetKeyRef.current = resetKey;
    if (viewMode !== 'visual' || !initializedRef.current || !editorRef.current) return;
    if (cleanHtml(editorRef.current) !== (value || '')) editorRef.current.innerHTML = value || '';
  }, [resetKey, value, viewMode]);

  // Every DOM mutation (typing, execCommand, image resize, …) → parent.
  useEffect(() => {
    if (viewMode !== 'visual') return;
    const editor = editorRef.current;
    if (!editor) return;
    // Enter creates <p> (not Chrome's default <div>) so articles get real paragraphs.
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      /* unsupported browser — harmless */
    }
    const observer = new MutationObserver(() => onChangeRef.current?.(cleanHtml(editor)));
    observer.observe(editor, { childList: true, subtree: true, characterData: true, attributes: true });
    return () => observer.disconnect();
  }, [viewMode]);

  // Click outside the editor + its toolbars → drop image / link selection.
  useEffect(() => {
    const onDown = (e) => {
      const t = e.target;
      if (editorRef.current?.contains(t)) return;
      if (toolbarRef.current?.contains(t)) return;
      if (imgToolbarRef.current?.contains(t) || linkToolbarRef.current?.contains(t)) return;
      const img = selectedImgRef.current;
      if (img) img.removeAttribute(SELECTED_ATTR);
      selectedImgRef.current = null;
      selectedLinkRef.current = null;
      setImgUi(null);
      setLinkUi(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // ── core helpers ──

  function syncContent() {
    if (editorRef.current) onChangeRef.current?.(cleanHtml(editorRef.current));
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current?.contains(range.commonAncestorContainer)) {
        savedSelectionRef.current = range.cloneRange();
      }
    }
  }

  function restoreSelection() {
    const sel = window.getSelection();
    if (!sel) return;
    const saved = savedSelectionRef.current;
    if (saved && editorRef.current?.contains(saved.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(saved);
      return;
    }
    // Nothing saved → caret at the end of the article.
    if (editorRef.current) {
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function detectFormats() {
    const formats = new Set();
    try {
      for (const cmd of ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList']) {
        if (document.queryCommandState(cmd)) formats.add(cmd);
      }
      const block = document.queryCommandValue('formatBlock');
      if (block) formats.add(String(block).toLowerCase().replace(/[<>]/g, ''));
    } catch {
      /* queryCommand* can throw when the selection is outside an editable */
    }
    setActiveFormats(formats);
  }

  function exec(command, val) {
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    syncContent();
    detectFormats();
  }

  function insertHtml(html) {
    editorRef.current?.focus();
    restoreSelection();
    const ok = document.execCommand('insertHTML', false, html);
    if (!ok && editorRef.current) editorRef.current.insertAdjacentHTML('beforeend', html);
    syncContent();
    detectFormats();
  }

  /** Toolbar action wrapper: remember the caret first. */
  const tool = (fn) => () => {
    saveSelection();
    fn();
  };

  function currentBlock() {
    try {
      return String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, '');
    } catch {
      return '';
    }
  }

  function toggleBlock(tag) {
    exec('formatBlock', currentBlock() === tag ? '<p>' : `<${tag}>`);
  }

  // ── image selection ──

  function refreshImgUi() {
    const img = selectedImgRef.current;
    setImgUi(img && img.isConnected ? positionIn(boxRef.current, img) : null);
  }

  function deselectImage() {
    const img = selectedImgRef.current;
    if (img) img.removeAttribute(SELECTED_ATTR);
    selectedImgRef.current = null;
    setImgUi(null);
  }

  function selectImage(img) {
    deselectImage();
    selectedImgRef.current = img;
    img.setAttribute(SELECTED_ATTR, '');
    setImgAlt(img.getAttribute('alt') || '');
    refreshImgUi();
  }

  function alignImage(alignment) {
    const img = selectedImgRef.current;
    if (!img) return;
    let parent = img.parentElement;
    // An image sitting directly in the editor gets a wrapper block.
    if (parent === editorRef.current) {
      const wrapper = document.createElement('div');
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
      parent = wrapper;
    }
    if (parent && parent !== editorRef.current) {
      parent.style.textAlign = alignment;
      img.style.display = 'block';
      img.style.marginLeft = alignment === 'left' ? '0' : 'auto';
      img.style.marginRight = alignment === 'right' ? '0' : 'auto';
    }
    requestAnimationFrame(refreshImgUi);
    syncContent();
  }

  function deleteSelectedImage() {
    const img = selectedImgRef.current;
    if (!img) return;
    deselectImage();
    img.remove();
    syncContent();
  }

  function updateImgAlt(newAlt) {
    setImgAlt(newAlt);
    const img = selectedImgRef.current;
    if (img) {
      img.setAttribute('alt', newAlt);
      syncContent();
    }
  }

  function startResize(e) {
    e.preventDefault();
    e.stopPropagation();
    const img = selectedImgRef.current;
    if (!img) return;
    resizeStartRef.current = { x: e.clientX, width: img.offsetWidth };

    const onMove = (ev) => {
      const start = resizeStartRef.current;
      if (!start || !selectedImgRef.current) return;
      const maxWidth = editorRef.current?.clientWidth || Infinity;
      const width = Math.min(maxWidth, Math.max(80, start.width + (ev.clientX - start.x)));
      selectedImgRef.current.style.width = `${Math.round(width)}px`;
      selectedImgRef.current.style.height = 'auto';
      refreshImgUi();
    };
    const onUp = () => {
      resizeStartRef.current = null;
      syncContent();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── link selection ──

  function deselectLink() {
    selectedLinkRef.current = null;
    setLinkUi(null);
  }

  function selectLink(link) {
    selectedLinkRef.current = link;
    const pos = positionIn(boxRef.current, link);
    if (pos) setLinkUi({ top: pos.top + 4, left: pos.left, href: link.getAttribute('href') || '' });
  }

  async function editSelectedLink() {
    const link = selectedLinkRef.current;
    if (!link) return;
    const current = link.getAttribute('href') || '';
    const next = await showPrompt('Edit link', 'Enter the new URL:', {
      placeholder: 'https://… or /some-article',
      icon: 'link',
      defaultValue: current,
    });
    if (next) {
      const url = safeUrl(next);
      if (!url) {
        showAlert('Invalid link', 'That URL scheme is not allowed.', 'warning');
      } else {
        link.setAttribute('href', url);
        syncContent();
      }
    }
    deselectLink();
  }

  function removeSelectedLink() {
    const link = selectedLinkRef.current;
    if (!link || !editorRef.current) return;
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(link);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('unlink', false);
    }
    syncContent();
    deselectLink();
  }

  function openSelectedLink() {
    const href = selectedLinkRef.current?.getAttribute('href');
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
  }

  // ── editor events ──

  function handleEditorClick(e) {
    const target = e.target;
    if (target.tagName === 'IMG') {
      e.preventDefault();
      deselectLink();
      selectImage(target);
    } else {
      deselectImage();
      const link = target.closest?.('a');
      if (link && editorRef.current?.contains(link)) {
        e.preventDefault();
        selectLink(link);
      } else {
        deselectLink();
      }
    }
    detectFormats();
  }

  function handleKeyDown(e) {
    if (selectedImgRef.current && (e.key === 'Backspace' || e.key === 'Delete')) {
      e.preventDefault();
      deleteSelectedImage();
      return;
    }
    if (e.key === 'Escape') {
      if (selectedImgRef.current) deselectImage();
      if (selectedLinkRef.current) deselectLink();
    }
  }

  function toggleViewMode() {
    deselectImage();
    deselectLink();
    if (viewMode === 'visual') {
      // Flush the live DOM first so the textarea opens with the latest edits.
      syncContent();
      setViewMode('html');
    } else {
      // Re-seed the contentEditable from the (possibly edited) raw HTML.
      initializedRef.current = false;
      setViewMode('visual');
    }
  }

  // ── toolbar actions ──

  function handleAlign(alignment) {
    if (selectedImgRef.current) alignImage(alignment);
    else exec(alignment === 'left' ? 'justifyLeft' : alignment === 'center' ? 'justifyCenter' : 'justifyRight');
  }

  async function insertLink() {
    const raw = await showPrompt('Insert link', 'Enter the URL — a full address or an internal path like /hostlov-i-stockholm:', {
      placeholder: 'https://… or /some-article',
      icon: 'link',
    });
    if (!raw) return;
    const url = safeUrl(raw);
    if (!url) {
      showAlert('Invalid link', 'That URL scheme is not allowed.', 'warning');
      return;
    }
    editorRef.current?.focus();
    restoreSelection();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
      exec('createLink', url);
    } else {
      // No text selected → insert the URL itself as the link text.
      insertHtml(`<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>&nbsp;`);
    }
  }

  async function insertImageUrl() {
    const raw = await showPrompt('Insert image URL', 'Enter the image URL:', {
      placeholder: 'https://example.com/image.webp',
      icon: 'image',
    });
    if (!raw) return;
    const url = safeUrl(raw, { allowDataImage: true });
    if (!url) {
      showAlert('Invalid image URL', 'That URL scheme is not allowed.', 'warning');
      return;
    }
    const alt =
      (await showPrompt('Alt text', 'Describe the image (SEO & accessibility):', {
        placeholder: 'Describe the image…',
        icon: 'text',
      })) || 'Bild';
    insertHtml(imageHtml(url, alt));
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const alt =
      (await showPrompt('Image alt text', 'Describe the image (SEO & accessibility):', {
        defaultValue: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
        icon: 'image',
      })) || file.name;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      if (res.status === 413) throw new Error('File too large (max 8 MB).');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      insertHtml(`${imageHtml(data.url, alt)}<p><br></p>`);
    } catch (err) {
      showAlert('Upload failed', err.message, 'danger');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function insertHR() {
    insertHtml('<hr style="border:none;border-top:1px solid #efecf2;margin:24px 0;" />');
  }

  async function insertTable() {
    const rows = await showPrompt('Insert table', 'Number of rows (including the header row):', {
      defaultValue: '3',
      icon: 'table',
    });
    if (!rows) return;
    const cols = await showPrompt('Insert table', 'Number of columns:', { defaultValue: '3', icon: 'table' });
    if (!cols) return;
    const r = Math.min(50, Math.max(1, parseInt(rows, 10) || 3));
    const c = Math.min(12, Math.max(1, parseInt(cols, 10) || 3));

    const border = '#d8d3e0';
    let html = '<table style="width:100%;border-collapse:collapse;margin:16px 0;"><thead><tr>';
    for (let j = 0; j < c; j++) {
      html += `<th style="border:1px solid ${border};padding:8px 12px;text-align:left;background:#fff4f8;font-weight:700;">Rubrik</th>`;
    }
    html += '</tr></thead><tbody>';
    for (let i = 0; i < r - 1; i++) {
      html += '<tr>';
      for (let j = 0; j < c; j++) html += `<td style="border:1px solid ${border};padding:8px 12px;">Cell</td>`;
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    insertHtml(html);
  }

  const isActive = (fmt) => activeFormats.has(fmt);
  const icon = 'w-4 h-4';

  // Floating image toolbar geometry (kept inside the box).
  const imgBarWidth = imgUi ? Math.min(Math.max(imgUi.width, 300), Math.max(200, imgUi.boxWidth - 16)) : 0;
  const imgBarLeft = imgUi ? Math.max(8, Math.min(imgUi.left, imgUi.boxWidth - imgBarWidth - 8)) : 0;

  return (
    <div
      ref={boxRef}
      className="famies-rte relative max-h-[75vh] overflow-y-auto rounded-2xl border border-ink-100 bg-white"
    >
      <style>{`.famies-rte img[${SELECTED_ATTR}]{outline:3px solid #ff8faf;outline-offset:2px;cursor:move}`}</style>

      {/* Toolbar */}
      <div
        ref={toolbarRef}
        className="sticky top-0 z-20 flex flex-wrap items-center gap-0.5 border-b border-ink-100 bg-ink-50/95 backdrop-blur px-3 py-2"
      >
        {/* Formatting acts on the contentEditable selection, so it is inert in HTML view. */}
        <div className={cn('flex flex-wrap items-center gap-0.5', viewMode === 'html' && 'opacity-40 pointer-events-none')}>
          <ToolBtn onAction={tool(() => exec('undo'))} title="Undo"><Undo2 className={icon} /></ToolBtn>
          <ToolBtn onAction={tool(() => exec('redo'))} title="Redo"><Redo2 className={icon} /></ToolBtn>

          <ToolDivider />

          <ToolBtn onAction={tool(() => toggleBlock('h2'))} title="Heading 2" active={isActive('h2')}><Heading2 className={icon} /></ToolBtn>
          <ToolBtn onAction={tool(() => toggleBlock('h3'))} title="Heading 3" active={isActive('h3')}><Heading3 className={icon} /></ToolBtn>
          <ToolBtn onAction={tool(() => toggleBlock('h4'))} title="Heading 4" active={isActive('h4')}><Heading4 className={icon} /></ToolBtn>
          <ToolBtn onAction={tool(() => exec('formatBlock', '<p>'))} title="Paragraph" active={isActive('p')}><Pilcrow className={icon} /></ToolBtn>

          <ToolDivider />

          <ToolBtn onAction={tool(() => exec('bold'))} title="Bold (Ctrl+B)" active={isActive('bold')}><Bold className={icon} /></ToolBtn>
          <ToolBtn onAction={tool(() => exec('italic'))} title="Italic (Ctrl+I)" active={isActive('italic')}><Italic className={icon} /></ToolBtn>
          <ToolBtn onAction={tool(() => exec('underline'))} title="Underline (Ctrl+U)" active={isActive('underline')}><Underline className={icon} /></ToolBtn>
          <ToolBtn onAction={tool(() => exec('strikeThrough'))} title="Strikethrough" active={isActive('strikeThrough')}><Strikethrough className={icon} /></ToolBtn>
          <ToolBtn onAction={tool(() => exec('removeFormat'))} title="Clear formatting"><RemoveFormatting className={icon} /></ToolBtn>

          <ToolDivider />

          <ToolBtn onAction={tool(() => exec('insertUnorderedList'))} title="Bullet list" active={isActive('insertUnorderedList')}><List className={icon} /></ToolBtn>
          <ToolBtn onAction={tool(() => exec('insertOrderedList'))} title="Numbered list" active={isActive('insertOrderedList')}><ListOrdered className={icon} /></ToolBtn>

          <ToolDivider />

          <ToolBtn onAction={tool(() => handleAlign('left'))} title="Align left"><AlignLeft className={icon} /></ToolBtn>
          <ToolBtn onAction={tool(() => handleAlign('center'))} title="Align center"><AlignCenter className={icon} /></ToolBtn>
          <ToolBtn onAction={tool(() => handleAlign('right'))} title="Align right"><AlignRight className={icon} /></ToolBtn>

          <ToolDivider />

          <ToolBtn onAction={tool(() => toggleBlock('blockquote'))} title="Quote" active={isActive('blockquote')}><Quote className={icon} /></ToolBtn>
          <ToolBtn onAction={tool(() => toggleBlock('pre'))} title="Code block" active={isActive('pre')}><Code className={icon} /></ToolBtn>
          <ToolBtn onAction={tool(insertHR)} title="Horizontal line"><Minus className={icon} /></ToolBtn>
          <ToolBtn onAction={tool(insertTable)} title="Insert table"><Table className={icon} /></ToolBtn>

          <ToolDivider />

          <ToolBtn onAction={tool(insertLink)} title="Insert link"><LinkIcon className={icon} /></ToolBtn>
          <ToolBtn onAction={tool(insertImageUrl)} title="Image from URL"><ImageIcon className={icon} /></ToolBtn>
          <ToolBtn onAction={tool(() => fileInputRef.current?.click())} title="Upload image">
            {uploading ? <Loader2 className={cn(icon, 'animate-spin text-primary')} /> : <Upload className={icon} />}
          </ToolBtn>
          <input ref={fileInputRef} type="file" accept={IMAGE_ACCEPT} onChange={handleFileUpload} className="hidden" />
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            toggleViewMode();
          }}
          title={viewMode === 'visual' ? 'Switch to HTML view' : 'Switch to visual view'}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors',
            viewMode === 'html'
              ? 'bg-primary/15 text-primary-700 ring-1 ring-primary/30'
              : 'text-ink-500 hover:text-ink-900 hover:bg-ink-100'
          )}
        >
          {viewMode === 'visual' ? (
            <>
              <FileCode2 className="w-3.5 h-3.5" /> HTML
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" /> Visual
            </>
          )}
        </button>
      </div>

      {/* Raw HTML view */}
      {viewMode === 'html' && (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="block w-full min-h-[500px] px-6 py-5 font-mono text-[12px] leading-relaxed text-ink-900 bg-white outline-none resize-y border-0"
          style={{ tabSize: 2 }}
          placeholder="<!-- Paste or edit raw HTML here. Switch back to Visual to preview. -->"
        />
      )}

      {/* Visual editor — hidden (not unmounted) in HTML view so refs stay alive */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        hidden={viewMode === 'html'}
        data-placeholder={placeholder}
        onInput={() => {
          syncContent();
          detectFormats();
        }}
        onBlur={() => {
          saveSelection();
          syncContent();
        }}
        onKeyUp={detectFormats}
        onKeyDown={handleKeyDown}
        onMouseUp={detectFormats}
        onClick={handleEditorClick}
        className={cn(
          'min-h-[500px] px-6 py-5 text-[15px] leading-relaxed text-ink-900 outline-none max-w-none',
          'empty:before:content-[attr(data-placeholder)] empty:before:text-ink-300 empty:before:pointer-events-none',
          CONTENT_CLASSES
        )}
      />

      {/* Image toolbar */}
      {imgUi && (
        <div
          ref={imgToolbarRef}
          contentEditable={false}
          className="absolute z-30 flex items-center gap-1.5 rounded-xl border border-ink-100 bg-white/95 px-2 py-1.5 shadow-soft backdrop-blur"
          style={{ top: imgUi.top + 6, left: imgBarLeft, width: imgBarWidth }}
        >
          <span className="shrink-0 text-[10px] font-black uppercase text-primary-700">Alt</span>
          <input
            type="text"
            value={imgAlt}
            onChange={(e) => updateImgAlt(e.target.value)}
            placeholder="Describe the image for SEO…"
            className="min-w-0 flex-1 rounded-md border border-ink-100 bg-ink-50 px-2 py-1 text-xs text-ink-900 outline-none focus:border-primary"
          />
          <button
            type="button"
            onMouseDown={startResize}
            className="p-1 rounded text-ink-500 hover:text-ink-900 cursor-ew-resize"
            title="Drag left/right to resize"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={deleteSelectedImage}
            className="p-1 rounded text-red-500 hover:bg-red-50"
            title="Delete image (Backspace)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={deselectImage} className="p-1 rounded text-ink-300 hover:text-ink-900" title="Deselect (Esc)">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Link toolbar */}
      {linkUi && (
        <div
          ref={linkToolbarRef}
          contentEditable={false}
          className="absolute z-30 flex items-center gap-1 rounded-xl border border-ink-100 bg-white/95 px-2 py-1.5 shadow-soft backdrop-blur"
          style={{ top: linkUi.top, left: linkUi.left }}
        >
          <LinkIcon className="w-3.5 h-3.5 shrink-0 text-primary-700" />
          <span className="mx-1.5 max-w-[220px] truncate text-xs text-ink-500" title={linkUi.href}>
            {linkUi.href || 'No URL'}
          </span>
          <div className="mx-0.5 h-4 w-px bg-ink-100" />
          <button type="button" onClick={editSelectedLink} className="p-1 rounded text-ink-500 hover:text-primary-700" title="Edit link URL">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={openSelectedLink} className="p-1 rounded text-ink-500 hover:text-primary-700" title="Open link in new tab">
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={removeSelectedLink} className="p-1 rounded text-red-500 hover:bg-red-50" title="Remove link (keep text)">
            <Unlink className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={deselectLink} className="p-1 rounded text-ink-300 hover:text-ink-900" title="Close">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
