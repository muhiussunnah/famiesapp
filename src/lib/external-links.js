/**
 * Admin-managed nofollow rules (/admin/external-links). Article HTML is
 * passed through applyNofollowRules() at render time, so changing a rule
 * updates every post without re-saving it.
 *
 * Rule types:
 *   domain → matches the host and all subdomains ("amazon.se" also hits
 *            "www.amazon.se" and "smile.amazon.se")
 *   url    → exact URL match (trailing slash and case ignored)
 */
import { cache } from 'react';
import { createPublicClient } from '@/lib/supabase/public';

export const getNofollowRules = cache(async function getNofollowRules() {
  const supabase = createPublicClient({ tags: ['nofollow-rules'] });
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('external_links_nofollow')
      .select('pattern, match_type')
      .eq('enabled', true);
    if (error) {
      console.error('[external-links] fetch error:', error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.error('[external-links] unexpected error:', err?.message || err);
    return [];
  }
});

function safeHostname(href) {
  try {
    return new URL(href).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function normalizeDomain(p) {
  return String(p || '')
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

function normalizeUrl(u) {
  return String(u || '').trim().replace(/\/+$/, '').toLowerCase();
}

export function hrefMatchesAnyRule(href, rules) {
  if (!rules?.length) return false;
  const hrefHost = safeHostname(href);

  for (const rule of rules) {
    if (rule.match_type === 'url') {
      if (normalizeUrl(href) === normalizeUrl(rule.pattern)) return true;
      continue;
    }
    if (!hrefHost) continue;
    const ruleDomain = normalizeDomain(rule.pattern);
    if (!ruleDomain) continue;
    const host = hrefHost.replace(/^www\./, '');
    if (host === ruleDomain || host.endsWith('.' + ruleDomain)) return true;
  }
  return false;
}

function addRelToken(existing, token) {
  const tokens = new Set(
    (existing ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => t.toLowerCase())
  );
  tokens.add(token.toLowerCase());
  return Array.from(tokens).join(' ');
}

/** Add rel="nofollow" to every <a href> in `html` that matches a rule. */
export function applyNofollowRules(html, rules) {
  if (!html || !rules?.length) return html;

  return html.replace(/<a\s+([^>]*?)>/gi, (full, rawAttrs) => {
    const hrefMatch = rawAttrs.match(/href\s*=\s*("([^"]*)"|'([^']*)')/i);
    const href = hrefMatch ? (hrefMatch[2] ?? hrefMatch[3] ?? '') : '';
    if (!href || !hrefMatchesAnyRule(href, rules)) return full;

    const relMatch = rawAttrs.match(/rel\s*=\s*("([^"]*)"|'([^']*)')/i);
    const existingRel = relMatch ? (relMatch[2] ?? relMatch[3] ?? '') : null;
    const newRel = addRelToken(existingRel, 'nofollow');

    const newAttrs = relMatch
      ? rawAttrs.replace(relMatch[0], `rel="${newRel}"`)
      : `${rawAttrs.trimEnd()} rel="${newRel}"`;
    return `<a ${newAttrs}>`;
  });
}
