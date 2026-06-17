import { dbGet, dbSet, dbDel, dbKeys, dbValues, settingsStore } from '@/storage/db';
import type { ThemeInfo } from './index';

/**
 * Custom (user-authored) themes. A theme is, at heart, a set of CSS variables
 * applied via a `.theme-<id>` rule — exactly like the built-in themes, except
 * these live in IndexedDB and are injected into the document at runtime instead
 * of being bundled at build time.
 *
 * The portable file format (.mdtheme.json) is the full bundle below, so a theme
 * round-trips losslessly through export → upload.
 */

/** The tweakable CSS variables, in display order. Keep in sync with tokens.css. */
export const THEME_VARS: { key: string; label: string; type: 'color' | 'length' | 'text'; group: string }[] = [
  { key: '--bg', label: 'Background', type: 'color', group: 'Surfaces' },
  { key: '--bg-alt', label: 'Background (alt)', type: 'color', group: 'Surfaces' },
  { key: '--fg', label: 'Text', type: 'color', group: 'Surfaces' },
  { key: '--fg-muted', label: 'Muted text', type: 'color', group: 'Surfaces' },
  { key: '--accent', label: 'Accent', type: 'color', group: 'Surfaces' },
  { key: '--accent-2', label: 'Accent 2', type: 'color', group: 'Surfaces' },
  { key: '--rule', label: 'Rule / borders', type: 'color', group: 'Surfaces' },
  { key: '--code-bg', label: 'Code background', type: 'color', group: 'Code' },
  { key: '--code-fg', label: 'Code text', type: 'color', group: 'Code' },
  { key: '--code-border', label: 'Code border', type: 'color', group: 'Code' },
  { key: '--font-heading', label: 'Heading font', type: 'text', group: 'Type' },
  { key: '--font-body', label: 'Body font', type: 'text', group: 'Type' },
  { key: '--font-mono', label: 'Mono font', type: 'text', group: 'Type' },
  { key: '--weight-heading', label: 'Heading weight', type: 'text', group: 'Type' },
  { key: '--scale-h1', label: 'H1 size', type: 'length', group: 'Scale' },
  { key: '--scale-h2', label: 'H2 size', type: 'length', group: 'Scale' },
  { key: '--scale-h3', label: 'H3 size', type: 'length', group: 'Scale' },
  { key: '--scale-body', label: 'Body size', type: 'length', group: 'Scale' },
  { key: '--scale-small', label: 'Small size', type: 'length', group: 'Scale' },
  { key: '--slide-padding', label: 'Slide padding', type: 'length', group: 'Layout' },
  { key: '--slide-radius', label: 'Corner radius', type: 'length', group: 'Layout' },
];

export type ThemeVars = Record<string, string>;

export interface CustomTheme {
  /** Stable, slug-like id used in the `.theme-<id>` selector and frontmatter. */
  id: string;
  name: string;
  category: 'dev-dark' | 'dev-light' | 'design';
  /** Shiki theme id used to highlight code blocks for this theme. */
  shikiTheme: string;
  /** The resolved CSS variable map (--bg, --accent, …). */
  vars: ThemeVars;
  /** Optional freeform CSS appended after the variable block (advanced). */
  extraCss?: string;
  createdAt: number;
  updatedAt: number;
}

/** Sensible defaults so a fresh theme renders immediately (mirrors catppuccin-mocha). */
export const DEFAULT_THEME_VARS: ThemeVars = {
  '--bg': '#1e1e2e',
  '--bg-alt': '#181825',
  '--fg': '#cdd6f4',
  '--fg-muted': '#a6adc8',
  '--accent': '#cba6f7',
  '--accent-2': '#f5c2e7',
  '--rule': '#45475a',
  '--code-bg': '#181825',
  '--code-fg': '#cdd6f4',
  '--code-border': '#313244',
  '--font-heading': '"Inter", system-ui, sans-serif',
  '--font-body': '"Inter", system-ui, sans-serif',
  '--font-mono': '"JetBrains Mono", ui-monospace, monospace',
  '--weight-heading': '700',
  '--scale-h1': '5.5rem',
  '--scale-h2': '3.25rem',
  '--scale-h3': '2.25rem',
  '--scale-body': '1.75rem',
  '--scale-small': '1.25rem',
  '--slide-padding': '5rem',
  '--slide-radius': '0',
};

const KEY_PREFIX = 'theme:';
/** Custom theme ids carry this prefix so they can never collide with built-ins. */
export const CUSTOM_PREFIX = 'custom-';

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return CUSTOM_PREFIX + (base || 'theme');
}

export function isCustomThemeId(id: string): boolean {
  return id.startsWith(CUSTOM_PREFIX);
}

/** Escape a value for safe interpolation inside a CSS declaration. */
function sanitizeVarValue(v: string): string {
  // Disallow rule terminators / block escapes that could break out of the
  // declaration. Custom themes are local-only, but keep the output well-formed.
  return String(v).replace(/[;{}<]/g, '').trim();
}

/** Build the `.theme-<id>` CSS for a custom theme. */
export function themeToCss(theme: CustomTheme): string {
  const sel = `.theme-${theme.id}`;
  const decls = Object.entries(theme.vars)
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => `  ${k}: ${sanitizeVarValue(v)};`)
    .join('\n');
  const base = `${sel} {\n${decls}\n}`;
  // Sensible accent-aware defaults so custom themes match the polish of the
  // built-ins without the author having to write these by hand.
  const flourish =
    `${sel} .slide-canvas h2 { color: var(--accent); }\n` +
    `${sel} .slide-canvas a { color: var(--accent); text-decoration-color: var(--accent-2); }\n` +
    `${sel} .slide-canvas blockquote { border-left: 4px solid var(--accent); color: var(--fg-muted); }`;
  const extra = theme.extraCss ? `\n${theme.extraCss}` : '';
  return `${base}\n${flourish}${extra}\n`;
}

export function themeToThemeInfo(theme: CustomTheme): ThemeInfo {
  return {
    id: theme.id,
    name: theme.name,
    category: theme.category,
    shikiTheme: theme.shikiTheme,
    swatch: {
      bg: theme.vars['--bg'] ?? '#1e1e2e',
      fg: theme.vars['--fg'] ?? '#cdd6f4',
      accent: theme.vars['--accent'] ?? '#cba6f7',
    },
  };
}

// ---------------------------------------------------------------------------
// Persistence (IndexedDB, app-wide via the existing settings store)
// ---------------------------------------------------------------------------

export async function loadCustomThemes(): Promise<CustomTheme[]> {
  const keys = (await dbKeys(settingsStore)) as string[];
  if (!keys.some((k) => typeof k === 'string' && k.startsWith(KEY_PREFIX))) return [];
  const all = (await dbValues(settingsStore)) as unknown[];
  return all
    .filter((v): v is CustomTheme => !!v && typeof v === 'object' && 'id' in (v as object) && isCustomThemeId((v as CustomTheme).id))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveCustomTheme(theme: CustomTheme): Promise<void> {
  await dbSet(KEY_PREFIX + theme.id, theme, settingsStore);
}

export async function deleteCustomTheme(id: string): Promise<void> {
  await dbDel(KEY_PREFIX + id, settingsStore);
}

export async function getCustomTheme(id: string): Promise<CustomTheme | undefined> {
  return (await dbGet(KEY_PREFIX + id, settingsStore)) as CustomTheme | undefined;
}

// ---------------------------------------------------------------------------
// Portable file format (.mdtheme.json)
// ---------------------------------------------------------------------------

interface ThemeFile {
  format: 'md-presentations-theme';
  version: 1;
  theme: Omit<CustomTheme, 'createdAt' | 'updatedAt'>;
}

export function serializeTheme(theme: CustomTheme): string {
  const file: ThemeFile = {
    format: 'md-presentations-theme',
    version: 1,
    theme: {
      id: theme.id,
      name: theme.name,
      category: theme.category,
      shikiTheme: theme.shikiTheme,
      vars: theme.vars,
      extraCss: theme.extraCss,
    },
  };
  return JSON.stringify(file, null, 2);
}

/**
 * Parse an uploaded theme file. Accepts the native .mdtheme.json bundle. To be
 * forgiving, it also accepts a bare theme object or a raw CSS string (a
 * `.theme-x { … }` block), deriving metadata where it can.
 */
export function parseThemeFile(text: string, fallbackName = 'Imported theme'): Omit<CustomTheme, 'createdAt' | 'updatedAt'> {
  const trimmed = text.trim();

  // Try JSON first.
  if (trimmed.startsWith('{')) {
    let obj: any;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      throw new Error('Theme file is not valid JSON.');
    }
    const t = obj?.theme && typeof obj.theme === 'object' ? obj.theme : obj;
    if (!t || typeof t !== 'object' || !t.vars || typeof t.vars !== 'object') {
      throw new Error('Theme JSON is missing a "vars" object.');
    }
    const name = typeof t.name === 'string' && t.name.trim() ? t.name.trim() : fallbackName;
    return {
      id: typeof t.id === 'string' && isCustomThemeId(t.id) ? t.id : slugify(name),
      name,
      category: ['dev-dark', 'dev-light', 'design'].includes(t.category) ? t.category : 'dev-dark',
      shikiTheme: typeof t.shikiTheme === 'string' ? t.shikiTheme : 'github-dark',
      vars: { ...DEFAULT_THEME_VARS, ...t.vars },
      extraCss: typeof t.extraCss === 'string' ? t.extraCss : undefined,
    };
  }

  // Fallback: raw CSS — pull `--var: value;` pairs out of the first rule block.
  const vars: ThemeVars = { ...DEFAULT_THEME_VARS };
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  let found = false;
  while ((m = re.exec(trimmed)) !== null) {
    vars[m[1].trim()] = m[2].trim();
    found = true;
  }
  if (!found) throw new Error('Could not find any CSS variables in the uploaded file.');
  return {
    id: slugify(fallbackName),
    name: fallbackName,
    category: 'dev-dark',
    shikiTheme: 'github-dark',
    vars,
  };
}
