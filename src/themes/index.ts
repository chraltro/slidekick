export interface ThemeInfo {
  id: string;
  name: string;
  category: 'dev-dark' | 'dev-light' | 'design';
  shikiTheme: string;
  swatch: { bg: string; fg: string; accent: string };
}

export const THEMES: ThemeInfo[] = [
  // Developer dark
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    category: 'dev-dark',
    shikiTheme: 'catppuccin-mocha',
    swatch: { bg: '#1e1e2e', fg: '#cdd6f4', accent: '#cba6f7' },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    category: 'dev-dark',
    shikiTheme: 'tokyo-night',
    swatch: { bg: '#1a1b26', fg: '#c0caf5', accent: '#7aa2f7' },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    category: 'dev-dark',
    shikiTheme: 'dracula',
    swatch: { bg: '#282a36', fg: '#f8f8f2', accent: '#ff79c6' },
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    category: 'dev-dark',
    shikiTheme: 'github-dark',
    swatch: { bg: '#282828', fg: '#ebdbb2', accent: '#fabd2f' },
  },
  {
    id: 'nord',
    name: 'Nord',
    category: 'dev-dark',
    shikiTheme: 'nord',
    swatch: { bg: '#2e3440', fg: '#eceff4', accent: '#88c0d0' },
  },
  {
    id: 'rose-pine',
    name: 'Rosé Pine',
    category: 'dev-dark',
    shikiTheme: 'rose-pine',
    swatch: { bg: '#191724', fg: '#e0def4', accent: '#ebbcba' },
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    category: 'dev-dark',
    shikiTheme: 'one-dark-pro',
    swatch: { bg: '#282c34', fg: '#abb2bf', accent: '#61afef' },
  },
  {
    id: 'midnight-terminal',
    name: 'Midnight Terminal',
    category: 'dev-dark',
    shikiTheme: 'github-dark',
    swatch: { bg: '#000000', fg: '#d4d4d4', accent: '#00ff88' },
  },

  // Developer light
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    category: 'dev-light',
    shikiTheme: 'catppuccin-latte',
    swatch: { bg: '#eff1f5', fg: '#4c4f69', accent: '#8839ef' },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    category: 'dev-light',
    shikiTheme: 'solarized-light',
    swatch: { bg: '#fdf6e3', fg: '#586e75', accent: '#268bd2' },
  },

  // Design-led
  {
    id: 'editorial-serif',
    name: 'Editorial Serif',
    category: 'design',
    shikiTheme: 'min-light',
    swatch: { bg: '#fafaf7', fg: '#1a1a1a', accent: '#b91c1c' },
  },
  {
    id: 'brutalist-mono',
    name: 'Brutalist Mono',
    category: 'design',
    shikiTheme: 'github-light',
    swatch: { bg: '#ffffff', fg: '#000000', accent: '#ff0000' },
  },
  {
    id: 'minimal-sans',
    name: 'Minimal Sans',
    category: 'design',
    shikiTheme: 'min-light',
    swatch: { bg: '#fcfcfc', fg: '#111111', accent: '#2563eb' },
  },
  {
    id: 'pastel-notebook',
    name: 'Pastel Notebook',
    category: 'design',
    shikiTheme: 'min-light',
    swatch: { bg: '#fffaf0', fg: '#2a2a2a', accent: '#ea580c' },
  },
  {
    id: 'gradient-dawn',
    name: 'Gradient Dawn',
    category: 'design',
    shikiTheme: 'min-light',
    swatch: { bg: '#fbcfe8', fg: '#ffffff', accent: '#a5b4fc' },
  },
  {
    id: 'corporate-clean',
    name: 'Corporate Clean',
    category: 'design',
    shikiTheme: 'github-light',
    swatch: { bg: '#ffffff', fg: '#0f172a', accent: '#1e3a8a' },
  },
  {
    id: 'academic-paper',
    name: 'Academic Paper',
    category: 'design',
    shikiTheme: 'solarized-light',
    swatch: { bg: '#fefefe', fg: '#1a1a1a', accent: '#6b21a8' },
  },
];

// Vite glob importer — loads each theme CSS as inline string on demand.
export const THEME_CSS_LOADERS: Record<string, () => Promise<string>> = import.meta.glob(
  './*.css',
  { query: '?inline', import: 'default' },
) as any;

export function getTheme(id: string): ThemeInfo | undefined {
  return THEMES.find((t) => t.id === id);
}
