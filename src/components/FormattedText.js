import { Fragment } from 'react';

const TOKEN = /(\*\*[^*]+?\*\*|\*[^*\n]+?\*)/g;

function withLineBreaks(text) {
  return text.split('\n').map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line}
    </Fragment>
  ));
}

/** The text without the formatting marks, for alt / aria-label attributes. */
export const plainText = (text) => String(text || '').replace(/\*\*?/g, '').replace(/\s*\n\s*/g, ' ');

/**
 * Admin-edited homepage text → React nodes (never HTML):
 *   *word* → brand gradient, **words** → bold, new line → <br />.
 */
export function formatText(
  text,
  { strongClassName = 'text-ink-900 dark:text-white font-semibold', accentClassName = 'text-brand-gradient' } = {}
) {
  if (!text) return null;
  return String(text)
    .split(TOKEN)
    .map((part, i) => {
      if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
        return <span key={i} className={strongClassName}>{withLineBreaks(part.slice(2, -2))}</span>;
      }
      if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
        return <span key={i} className={accentClassName}>{part.slice(1, -1)}</span>;
      }
      return <Fragment key={i}>{withLineBreaks(part)}</Fragment>;
    });
}
