/** Maps an app theme id to the Shiki theme that best matches it. */
export const THEME_TO_SHIKI: Record<string, string> = {
  'catppuccin-mocha': 'catppuccin-mocha',
  'catppuccin-latte': 'catppuccin-latte',
  'tokyo-night': 'tokyo-night',
  dracula: 'dracula',
  'gruvbox-dark': 'github-dark',
  nord: 'nord',
  'rose-pine': 'rose-pine',
  'one-dark': 'one-dark-pro',
  'solarized-light': 'solarized-light',
  'editorial-serif': 'min-light',
  'brutalist-mono': 'github-light',
  'minimal-sans': 'min-light',
  'pastel-notebook': 'min-light',
  'gradient-dawn': 'min-light',
  'corporate-clean': 'github-light',
  'academic-paper': 'solarized-light',
  'midnight-terminal': 'github-dark',
};

export const SHIKI_THEMES = [
  'catppuccin-mocha',
  'catppuccin-latte',
  'tokyo-night',
  'dracula',
  'github-light',
  'github-dark',
  'nord',
  'rose-pine',
  'one-dark-pro',
  'solarized-light',
  'min-light',
  'min-dark',
] as const;

export const SHIKI_LANGS = [
  'ts',
  'tsx',
  'js',
  'jsx',
  'python',
  'rust',
  'go',
  'java',
  'c',
  'cpp',
  'csharp',
  'html',
  'css',
  'json',
  'yaml',
  'toml',
  'bash',
  'shell',
  'sql',
  'diff',
  'md',
  'markdown',
] as const;

export function shikiThemeFor(appTheme: string): string {
  return THEME_TO_SHIKI[appTheme] ?? 'github-dark';
}
