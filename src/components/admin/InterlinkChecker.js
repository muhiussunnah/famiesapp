'use client';
/**
 * Interlink Checker — scans the article for mentions of other Famies pages
 * and suggests internal links. "Approve all" / "+" wraps the first mention
 * (outside headings, existing links and code) in <a href="/slug">.
 *
 *   <InterlinkChecker content={html} currentSlug="/my-post" onContentChange={fn} />
 *
 * Without onContentChange it is read-only (copy-URL buttons only).
 * Matching ignores case and Swedish diacritics, so the slug keyword
 * "hostlov i stockholm" also matches "Höstlov i Stockholm".
 */
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link2, Copy, Check, ChevronDown, ChevronUp, Loader2, Zap, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { absoluteUrl } from '@/lib/site';
import { Badge } from '@/components/admin/ui';

// Fixed pages of the site worth linking to, with Swedish trigger phrases.
const STATIC_ARTICLES = [
  { slug: '/', title: 'Famies – familjeappen', keywords: ['famies-appen', 'appen famies', 'famies app', 'ladda ner famies'] },
  { slug: '/skapa-event', title: 'Skapa event', keywords: ['skapa event', 'skapa ett event', 'tipsa om ett event', 'tipsa famies'] },
  { slug: '/inspiration', title: 'Inspiration – alla artiklar', keywords: ['mer inspiration', 'fler familjetips', 'fler tips och idéer'] },
  { slug: '/early-access', title: 'Early access', keywords: ['early access', 'tidig tillgång'] },
  { slug: '/contact', title: 'Kontakt', keywords: ['kontakta famies', 'kontakta oss'] },
];

// Text inside these tags is never linked (no nested anchors, no linked
// headings, no broken code samples).
const SKIP_TAGS = new Set(['A', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'CODE', 'PRE', 'SCRIPT', 'STYLE', 'BUTTON']);

const MARKS_RE = /[̀-ͯ]/g;

/**
 * Lowercase + strip diacritics, character by character, so the folded
 * string keeps the exact length of the input (indices map 1:1).
 */
function fold(str) {
  let out = '';
  for (const ch of String(str || '')) {
    const base = ch.normalize('NFD').replace(MARKS_RE, '');
    const pick = base.length === ch.length ? base : ch;
    const lower = pick.toLowerCase();
    out += lower.length === pick.length ? lower : pick;
  }
  return out;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word (Unicode-aware) regex for an already folded keyword. */
function keywordRegex(foldedKeyword) {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(foldedKeyword)}(?![\\p{L}\\p{N}])`, 'u');
}

/** Parse into an inert document: no image loads, no inline handlers run. */
function parseHtml(html) {
  const doc = document.implementation.createHTMLDocument('');
  const div = doc.createElement('div');
  div.innerHTML = html || '';
  return div;
}

/** "/foo/" | "https://famies.app/foo?x#y" → "/foo"; external links → null. */
function internalPath(href) {
  if (!href) return null;
  try {
    const site = new URL(absoluteUrl('/'));
    const url = new URL(href, site);
    const host = (h) => h.replace(/^www\./, '');
    if (host(url.host) !== host(site.host)) return null;
    const path = url.pathname.replace(/\/+$/, '');
    return path || '/';
  } catch {
    return null;
  }
}

/**
 * Wrap the first text-node match of `regex` (run on folded text) inside
 * `root` with <a href={slug}>. Walks text nodes, so attribute values and
 * tags can never be split.
 */
function wrapFirstMatch(root, regex, slug) {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      for (let el = node.parentElement; el && el !== root; el = el.parentElement) {
        if (SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue || '';
    const m = fold(text).match(regex);
    if (m && m.index !== undefined) {
      const before = text.slice(0, m.index);
      const matched = text.slice(m.index, m.index + m[0].length); // original casing
      const after = text.slice(m.index + m[0].length);

      const frag = doc.createDocumentFragment();
      if (before) frag.appendChild(doc.createTextNode(before));
      const a = doc.createElement('a');
      a.setAttribute('href', slug);
      a.textContent = matched;
      frag.appendChild(a);
      if (after) frag.appendChild(doc.createTextNode(after));
      node.parentNode.replaceChild(frag, node);
      return true;
    }
  }
  return false;
}

/** Link the first mention of each match's keyword. Returns the new HTML. */
function applyInterlinks(html, matches) {
  if (!html || matches.length === 0) return html;
  const container = parseHtml(html);
  for (const match of matches) wrapFirstMatch(container, keywordRegex(fold(match.keyword)), match.slug);
  return container.innerHTML;
}

function articleFromPost(p) {
  const slug = p.slug.startsWith('/') ? p.slug : `/${p.slug}`;
  const slugWords = slug.replace(/^\//, '').replace(/-/g, ' ').trim();
  const keywords = [p.title.trim()];
  if (slugWords.includes(' ')) keywords.push(slugWords);
  return { slug, title: p.title, keywords };
}

export default function InterlinkChecker({ content, currentSlug, onContentChange }) {
  const [dynamicArticles, setDynamicArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [appliedSlug, setAppliedSlug] = useState(null);

  // Scanning parses the whole article — keep typing smooth.
  const deferredContent = useDeferredValue(content || '');

  // Every published post (not just the first page of the admin list).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/posts?index=1')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const posts = Array.isArray(data.posts) ? data.posts : [];
        setDynamicArticles(posts.filter((p) => p.status === 'published' && p.slug && p.title).map(articleFromPost));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Static + dynamic, deduplicated by slug.
  const allArticles = useMemo(() => {
    const seen = new Set(STATIC_ARTICLES.map((a) => a.slug));
    const merged = [...STATIC_ARTICLES];
    for (const a of dynamicArticles) {
      if (!seen.has(a.slug)) {
        merged.push(a);
        seen.add(a.slug);
      }
    }
    return merged;
  }, [dynamicArticles]);

  const matches = useMemo(() => {
    if (deferredContent.trim().length < 10) return [];

    const root = parseHtml(deferredContent);
    const text = fold(root.textContent || '');
    const linked = new Set(
      [...root.querySelectorAll('a[href]')].map((a) => internalPath(a.getAttribute('href'))).filter(Boolean)
    );
    const current = currentSlug ? internalPath(currentSlug.startsWith('/') ? currentSlug : `/${currentSlug}`) : null;

    const found = [];
    for (const article of allArticles) {
      if (current && article.slug === current) continue; // the article being edited
      if (linked.has(article.slug)) continue; // already linked
      for (const keyword of article.keywords) {
        const folded = fold(keyword).trim();
        if (folded.length < 3) continue;
        if (keywordRegex(folded).test(text)) {
          found.push({ keyword, slug: article.slug, title: article.title });
          break; // one suggestion per target page
        }
      }
    }
    return found;
  }, [deferredContent, allArticles, currentSlug]);

  const handleApply = (match) => {
    if (!onContentChange) return;
    const html = applyInterlinks(content, [match]);
    if (html !== content) {
      onContentChange(html);
      setAppliedSlug(match.slug);
      setTimeout(() => setAppliedSlug(null), 2000);
    } else {
      toast.error('Could not place that link (the mention is inside a heading or link).');
    }
  };

  const handleApplyAll = () => {
    if (!onContentChange || matches.length === 0) return;
    const html = applyInterlinks(content, matches);
    if (html !== content) {
      onContentChange(html);
      toast.success(`Inserted ${matches.length} internal ${matches.length === 1 ? 'link' : 'links'}`);
    }
  };

  const handleCopy = async (slug) => {
    const url = absoluteUrl(slug);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  return (
    <section className="rounded-2xl bg-white border border-ink-100 shadow-[0_1px_2px_rgba(12,10,19,0.04)] p-5">
      <button type="button" onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary-700" />
          <span className="text-[15px] font-bold text-ink-900">Interlink Checker</span>
          {matches.length > 0 && <Badge tone="pink">{matches.length}</Badge>}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-ink-300" /> : <ChevronDown className="w-4 h-4 text-ink-300" />}
      </button>

      {expanded && (
        <div className="mt-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-ink-500">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Scanning articles…
            </div>
          ) : matches.length === 0 ? (
            <p className="py-1 text-[13px] leading-relaxed text-ink-500">
              {deferredContent.trim().length < 10
                ? 'Start writing to see internal link suggestions.'
                : 'No interlink opportunities found — relevant pages are already linked or not mentioned.'}
            </p>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[13px] text-ink-500">
                  {matches.length} {matches.length === 1 ? 'opportunity' : 'opportunities'} found
                </p>
                {onContentChange && (
                  <button
                    type="button"
                    onClick={handleApplyAll}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-primary-500"
                    title={`Insert all ${matches.length} internal links into the content`}
                  >
                    <Zap className="w-3 h-3" />
                    Approve all ({matches.length})
                  </button>
                )}
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {matches.map((m) => (
                  <div key={m.slug} className="rounded-xl border border-ink-100 bg-ink-50 p-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-ink-500">
                          Mentions <span className="font-bold text-primary-700">&quot;{m.keyword}&quot;</span>
                        </p>
                        <p className="mt-1 truncate font-semibold text-ink-900">{m.title}</p>
                        <p className="mt-0.5 truncate text-ink-300">{m.slug}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {onContentChange && (
                          <button
                            type="button"
                            onClick={() => handleApply(m)}
                            className="rounded-md bg-primary/10 p-1.5 text-primary-700 transition-colors hover:bg-primary/20"
                            title="Insert this link into the content"
                          >
                            {appliedSlug === m.slug ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopy(m.slug)}
                          className={
                            copiedSlug === m.slug
                              ? 'rounded-md bg-emerald-50 p-1.5 text-emerald-600'
                              : 'rounded-md bg-white p-1.5 text-ink-500 transition-colors hover:text-ink-900'
                          }
                          title="Copy full URL"
                        >
                          {copiedSlug === m.slug ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
