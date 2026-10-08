/**
 * Builds the <style> block that applies the admin's Theme Colors
 * (/admin/theme) on top of the defaults in globals.css.
 *
 * Tailwind's `primary` / `secondary` DEFAULT colors read
 * --color-primary-rgb / --color-secondary-rgb (space-separated RGB so
 * opacity modifiers like bg-primary/10 keep working), so overriding those
 * variables recolors every button, link and highlight on the site.
 */

export const THEME_KEYS = ['theme_accent', 'theme_accent_hover', 'theme_mint', 'theme_bg', 'theme_text'];

/** "#ff8faf" / "#f8a" / "rgb(255, 143, 175)" → "255 143 175", or null. */
export function toRgbChannels(value) {
  const v = (value || '').trim();
  let m = v.match(/^#([0-9a-f]{3})$/i);
  if (m) {
    const [r, g, b] = m[1].split('').map((c) => parseInt(c + c, 16));
    return `${r} ${g} ${b}`;
  }
  m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
  }
  m = v.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i);
  if (m) return `${m[1]} ${m[2]} ${m[3]}`;
  return null;
}

/** Strip anything that could close the <style> tag. */
function sanitize(value) {
  return value.replace(/<\/?style[^>]*>/gi, '').replace(/<script/gi, '').replace(/[{};<>]/g, '');
}

export function buildThemeCSS(settings) {
  if (!settings) return '';
  const val = (k) => (typeof settings[k] === 'string' ? settings[k].trim() : '');
  const rules = [];

  const accent = val('theme_accent');
  const accentRgb = toRgbChannels(accent);
  if (accentRgb) {
    rules.push(`--color-primary-rgb: ${accentRgb};`, `--brand-pink: ${sanitize(accent)};`);
  }

  const hover = val('theme_accent_hover');
  const hoverRgb = toRgbChannels(hover);
  if (hoverRgb) rules.push(`--color-primary-hover-rgb: ${hoverRgb};`, `--brand-pink-deep: ${sanitize(hover)};`);

  const mint = val('theme_mint');
  const mintRgb = toRgbChannels(mint);
  if (mintRgb) rules.push(`--color-secondary-rgb: ${mintRgb};`, `--brand-mint: ${sanitize(mint)};`);

  const text = val('theme_text');
  if (text) rules.push(`--foreground: ${sanitize(text)};`);

  let css = rules.length ? `:root{${rules.join('')}}\n` : '';

  const bg = val('theme_bg');
  if (bg) css += `body{background:${sanitize(bg)};}\n`;

  return css;
}
