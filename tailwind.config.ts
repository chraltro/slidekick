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
        chrome: {
          bg: '#0f0f12',
          surface: '#16161c',
          border: '#26262e',
          fg: '#e4e4ea',
          muted: '#8a8a96',
          accent: '#cba6f7',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
