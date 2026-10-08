/**
 * Renders admin-pasted snippets (from /admin/header-scripts) as real
 * <meta>, <link>, <script> or <style> elements inside <head>.
 *
 * Wrapping them in a <span> would make the HTML parser close <head> early
 * and push every later tag into <body> — breaking Search Console / Bing
 * verification. Anything that is not a single supported tag is skipped.
 */

/** Parse HTML-style attributes out of an attribute substring. */
function parseAttrs(attrStr) {
  const result = {};
  const regex = /([a-zA-Z_][a-zA-Z0-9_:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match;
  while ((match = regex.exec(attrStr)) !== null) {
    const value = match[2] ?? match[3] ?? match[4];
    result[match[1]] = value !== undefined ? value : true;
  }
  return result;
}

/** HTML attribute name → React prop name, for the camelCase exceptions. */
const ATTR_MAP = {
  class: 'className',
  for: 'htmlFor',
  'http-equiv': 'httpEquiv',
  charset: 'charSet',
  crossorigin: 'crossOrigin',
  referrerpolicy: 'referrerPolicy',
  nomodule: 'noModule',
  fetchpriority: 'fetchPriority',
};

function toReactProps(attrs) {
  const props = {};
  for (const [k, v] of Object.entries(attrs)) {
    props[ATTR_MAP[k.toLowerCase()] ?? k] = v;
  }
  return props;
}

export function renderHeadScript(code, key) {
  const trimmed = (code || '').trim();
  if (!trimmed) return null;

  const metaMatch = trimmed.match(/^<meta\b([^>]*?)\s*\/?>$/i);
  if (metaMatch) return <meta key={key} {...toReactProps(parseAttrs(metaMatch[1]))} />;

  const linkMatch = trimmed.match(/^<link\b([^>]*?)\s*\/?>$/i);
  if (linkMatch) return <link key={key} {...toReactProps(parseAttrs(linkMatch[1]))} />;

  const scriptMatch = trimmed.match(/^<script\b([^>]*)>([\s\S]*?)<\/script>$/i);
  if (scriptMatch) {
    const attrs = toReactProps(parseAttrs(scriptMatch[1]));
    const inner = scriptMatch[2].trim();
    return inner
      ? <script key={key} {...attrs} dangerouslySetInnerHTML={{ __html: inner }} />
      : <script key={key} {...attrs} />;
  }

  const styleMatch = trimmed.match(/^<style\b([^>]*)>([\s\S]*?)<\/style>$/i);
  if (styleMatch) {
    const attrs = toReactProps(parseAttrs(styleMatch[1]));
    return <style key={key} {...attrs} dangerouslySetInnerHTML={{ __html: styleMatch[2] }} />;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.warn('[render-head-script] skipped unsupported <head> snippet:', trimmed.slice(0, 200));
  }
  return null;
}

/**
 * Render a snippet for the body_start / body_end positions. <script> tags
 * become real script elements (innerHTML-injected scripts never execute);
 * any other markup (e.g. GTM's <noscript> iframe) is kept as-is.
 */
export function renderBodySnippet(code, key) {
  const scripts = (code || '').match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [];
  const rest = (code || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').trim();
  return [
    rest ? <div key={`${key}-html`} style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: rest }} /> : null,
    ...scripts.map((s, i) => renderHeadScript(s, `${key}-s${i}`)),
  ];
}

/**
 * Split a pasted block that contains several tags (e.g. GA's two
 * <script> tags) into single-tag snippets so each can be rendered.
 */
export function splitHeadSnippets(code) {
  const out = [];
  const re = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>|<(meta|link)\b[^>]*\/?>/gi;
  let m;
  while ((m = re.exec(code || '')) !== null) out.push(m[0]);
  return out.length ? out : [code];
}
