/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--gn-color-background)',
        surface: 'var(--gn-color-surface)',
        'surface-elevated': 'var(--gn-color-surface-elevated)',
        'text-primary': 'var(--gn-color-text-primary)',
        'text-secondary': 'var(--gn-color-text-secondary)',
        primary: 'var(--gn-color-primary)',
        'primary-contrast': 'var(--gn-color-primary-contrast)',
        accent: 'var(--gn-color-accent)',
        error: 'var(--gn-color-error)',
        warning: 'var(--gn-color-warning)',
        success: 'var(--gn-color-success)',
        border: 'var(--gn-color-border)',
      },
      fontFamily: {
        sans: ['var(--gn-font-sans)'],
        mono: ['var(--gn-font-mono)'],
      },
      borderRadius: {
        sm: 'var(--gn-radius-sm)',
        md: 'var(--gn-radius-md)',
        lg: 'var(--gn-radius-lg)',
      },
      aria: {
        current: 'page',
      },
    },
  },
  plugins: [],
};
