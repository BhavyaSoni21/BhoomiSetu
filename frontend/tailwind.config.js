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
        /* ── New design-token palette (Part B exact) ── */
        brand: {
          900: '#0F3D2E',
          700: '#166534',
          600: '#15803D',
          300: '#86EFAC',
        },
        action: {
          700: '#B45309',
          600: '#D97706',
          500: '#F59E0B',
          on:  '#16241A',
        },
        earth: {
          700: '#92400E',
          500: '#B45309',
          300: '#D6A46F',
        },
        'text-heading':   '#0F3D2E',
        'text-body':      '#34413A',
        'text-secondary': '#53635A',
        'text-muted':     '#718078',
        gov: {
          border:  '#DDE5DF',
          success: '#16A34A',
          warning: '#D97706',
          error:   '#DC2626',
          info:    '#0F766E',
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
          dark:   '#071A14',
          spruce: '#0e241b',
          forest: '#0F3D2E',
          card:   '#0D261D',
          border: '#244438',
          leaf:   '#166534',
          sprout: '#15803D',
          mint:   '#34D399',
          soil:   '#92400E',
          clay:   '#B45309',
          sand:   '#D6A46F',
          gold:   '#F59E0B',
          paper:  '#F7FAF5',
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
