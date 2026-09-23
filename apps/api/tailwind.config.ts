import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B0D12',
        panel: '#0F1218',
        surface: '#14171F',
        edge: '#242938',
        edge2: '#2E3446',
        text: '#E9ECF3',
        dim: '#B8C0D0',
        muted: '#8B94A8',
        yes: '#2FB67C',
        no: '#E2565C',
        accent: '#6C8CFF',
        gold: '#F0B429',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        num: ['var(--font-num)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
