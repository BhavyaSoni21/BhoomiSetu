/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['"Inter"',          '"Montserrat"', '"Noto Sans"', 'sans-serif'],
        heading: ['"Montserrat"',     '"Inter"',      '"Noto Sans"', 'sans-serif'],
        display: ['"Montserrat"',     '"Inter"',      '"Noto Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"IBM Plex Mono"', 'monospace'],
      },
      colors: {
        /* ── New design-token palette (Part B exact) — CSS variable backed for dark mode ── */
        brand: {
          900: 'var(--brand-900)',
          800: '#14532D',
          700: 'var(--brand-700)',
          600: 'var(--brand-600)',
          300: 'var(--brand-300)',
        },
        'surface-1': 'var(--surface-1)',
        'surface-2': 'var(--surface-2)',
        action: {
          700: 'var(--action-700)',
          600: 'var(--action-600)',
          500: 'var(--action-500)',
          on:  'var(--action-text-on)',
        },
        earth: {
          700: 'var(--earth-700)',
          500: 'var(--earth-500)',
          300: 'var(--earth-300)',
        },
        'text-heading':   'var(--text-heading)',
        'text-body':      'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted':     'var(--text-muted)',
        gov: {
          border:  'var(--border)',
          success: 'var(--success)',
          warning: 'var(--warning)',
          error:   'var(--error)',
          info:    'var(--info)',
        },

        /* ── Legacy semantic tokens (CSS-variable backed, used by existing components) ── */
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          strong: 'rgb(var(--color-primary-strong) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--color-secondary) / <alpha-value>)',
          strong: 'rgb(var(--color-secondary-strong) / <alpha-value>)',
        },
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',

        /* ── Old bhoomi.* scale kept for backwards compat ── */
        bhoomi: {
          dark:   'var(--page-bg)',
          spruce: 'var(--surface-2)',
          forest: 'var(--brand-900)',
          card:   'var(--surface-1)',
          border: 'var(--border)',
          leaf:   'var(--brand-700)',
          sprout: 'var(--brand-600)',
          mint:   'var(--brand-300)',
          soil:   'var(--earth-700)',
          clay:   'var(--action-700)',
          sand:   'var(--earth-300)',
          gold:   'var(--action-500)',
          paper:  'var(--surface-2)',
        },
      },
      boxShadow: {
        'hard-sm':          '3px 3px 0 0 rgb(var(--shadow-color) / 1)',
        'hard-md':          '6px 6px 0 0 rgb(var(--shadow-color) / 1)',
        'hard-lg':          '8px 8px 0 0 rgb(var(--shadow-color) / 1)',
        'hard-sm-primary':  '3px 3px 0 0 rgb(var(--color-primary) / 1)',
        'hard-sm-accent':   '3px 3px 0 0 rgb(var(--color-accent) / 1)',
        'card':             '0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        'card-hover':       '0 8px 30px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
        'nav':              '0 8px 32px rgba(0,0,0,0.18)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      animation: {
        'fade-up':    'fadeUp 0.55s ease both',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'shimmer':    'shimmer 1.6s infinite',
      },
      transitionTimingFunction: {
        'gov': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
