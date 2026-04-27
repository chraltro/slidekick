import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Neutrals tint very slightly toward the mauve accent hue (~285°) so
        // surfaces, borders, and the accent feel cohesive instead of accidental.
        chrome: {
          bg: '#0e0e13',
          surface: '#16161d',
          'surface-hover': '#1c1c25',
          elevated: '#1f1f29',
          border: '#27272f',
          'border-strong': '#33333d',
          fg: '#e6e5ec',
          muted: '#8a8995',
          subtle: '#5b5a66',
          accent: '#cba6f7',
          'accent-soft': '#b894ec',
        },
      },
      ringWidth: {
        DEFAULT: '1px',
      },
    },
  },
  plugins: [],
} satisfies Config;
