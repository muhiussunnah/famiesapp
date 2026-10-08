import sanitizeHtml from 'sanitize-html';

/**
 * Sanitise article HTML coming from outside the admin editor (Writerfy).
 *
 * Keeps the rich markup articles need — headings, tables, figures, images,
 * embeds, classes, inline styles, data-* — but removes <script>/<style>,
 * every on* event handler and javascript: URLs. (sanitize-html with
 * `allowedTags: false` would keep <script>, so the tag list is explicit.)
 */
const ALLOWED_TAGS = [
  ...sanitizeHtml.defaults.allowedTags,
  'img', 'h1', 'h2', 'iframe', 'figure', 'figcaption', 'picture', 'source', 'video', 'audio',
  'span', 'div', 'section', 'article', 'aside', 'header', 'footer', 'details', 'summary',
  'mark', 'u', 's', 'del', 'ins', 'sup', 'sub', 'small', 'kbd', 'abbr', 'cite', 'time',
  'dl', 'dt', 'dd', 'colgroup', 'col', 'button', 'svg', 'path', 'circle', 'rect', 'g', 'line', 'polyline', 'polygon',
];

export function sanitizeArticleHtml(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: false,
    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
    allowedSchemesAppliedToAttributes: ['href', 'src', 'cite', 'action', 'poster', 'srcset', 'xlink:href'],
    allowProtocolRelative: true,
    allowedIframeHostnames: [
      'www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com',
      'www.google.com', 'maps.google.com', 'open.spotify.com', 'www.instagram.com', 'www.tiktok.com',
    ],
    parser: { lowerCaseAttributeNames: false },
    transformTags: {
      '*': (tagName, attribs) => {
        const clean = {};
        for (const [k, v] of Object.entries(attribs)) {
          if (/^on/i.test(k)) continue;
          if (typeof v === 'string' && /^\s*(javascript|vbscript):/i.test(v)) continue;
          clean[k] = v;
        }
        return { tagName, attribs: clean };
      },
    },
  });
}
