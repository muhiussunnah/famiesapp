/**
 * Server-side processing of post HTML before it is rendered:
 * heading anchors + table of contents, and Writerfy badge classes.
 */
import { slugify, plainText } from '@/lib/content-helpers';

/**
 * Give every <h2>/<h3> a stable id (keeping ids the author already set)
 * and return the TOC entries in document order.
 */
export function addHeadingIds(html) {
  const toc = [];
  const used = new Set();

  const out = String(html || '').replace(/<h([23])\b([^>]*)>([\s\S]*?)<\/h\1>/gi, (full, level, attrs, inner) => {
    const text = plainText(inner);
    if (!text) return full;

    const existing = attrs.match(/\sid\s*=\s*["']([^"']+)["']/i)?.[1];
    let id = existing || slugify(text, 60) || `rubrik-${toc.length + 1}`;
    if (!existing) {
      let n = 2;
      const base = id;
      while (used.has(id)) id = `${base}-${n++}`;
    }
    used.add(id);
    toc.push({ id, text, level: Number(level) });

    return existing ? full : `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
  });

  return { html: out, toc };
}

/** Split at the first <h2> so the TOC can sit right after the intro. */
export function splitAtFirstH2(html) {
  const idx = html.search(/<h2[\s>]/i);
  if (idx <= 0) return [idx === 0 ? '' : html, idx === 0 ? html : ''];
  return [html.slice(0, idx), html.slice(idx)];
}

/**
 * Writerfy gives every comparison-table badge the same class and only
 * differs in text ("EDITOR'S CHOICE", "TOP PICK", "BEST BUDGET"); add a
 * modifier class so each variant gets its own color.
 */
export function classifyTableBadges(html) {
  return String(html || '').replace(
    /<span\b([^>]*?)\bclass\s*=\s*(["'])([^"']*?\bwriterfy-table-badge\b[^"']*?)\2([^>]*)>([\s\S]*?)<\/span>/gi,
    (full, before, quote, classes, after, inner) => {
      if (/\bwf-tb-(editors|top|budget)\b/.test(classes)) return full;
      const text = plainText(inner).toUpperCase();
      const mod = text.includes('EDITOR')
        ? 'wf-tb-editors'
        : text.includes('TOP')
          ? 'wf-tb-top'
          : text.includes('BUDGET') || text.includes('BEST')
            ? 'wf-tb-budget'
            : '';
      if (!mod) return full;
      return `<span${before}class=${quote}${classes} ${mod}${quote}${after}>${inner}</span>`;
    }
  );
}
