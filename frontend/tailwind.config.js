/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Outfit is the Bauhaus display/body face; Noto Sans is listed second
        // in the SAME stack (not swapped per-language) because Outfit has no
        // Devanagari glyphs - the browser resolves each glyph against the
        // stack independently, so Hindi text in the same sentence as English
        // falls through to Noto Sans automatically with no locale branching.
        sans: ['"Outfit"', '"Noto Sans"', 'sans-serif'],
        display: ['"Outfit"', '"Noto Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      colors: {
        // Literal earth-tone scale (unchanged) - used for one-off decorative
        // accents (corner shapes, role badges) where a specific hue is
        // wanted regardless of theme.
        bhoomi: {
          dark: '#0a1a13',
          spruce: '#0e241b',
          forest: '#1b4332',
          card: '#142f24',
          border: '#234e3b',
          leaf: '#2d6a4f',
          sprout: '#40916c',
          mint: '#52b788',
          soil: '#7c3f1d',
          clay: '#935116',
          sand: '#c68b59',
          gold: '#e8963c',
          paper: '#f5f6f2',
        },
        // Semantic slots (docs/design.md §2) - CSS-variable backed so every
        // component that uses these repaints for dark mode with no `dark:`
        // variant of its own. Defined as RGB triplets in index.css so
        // opacity modifiers (bg-primary/20 etc.) keep working.
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
      },
      boxShadow: {
        // Hard offset shadows (docs/design.md §4) - solid, never blurred.
        // Color follows --shadow-color so they stay visible in dark mode
        // (a literal black shadow disappears against a near-black background).
        'hard-sm': '3px 3px 0 0 rgb(var(--shadow-color) / 1)',
        'hard-md': '6px 6px 0 0 rgb(var(--shadow-color) / 1)',
        'hard-lg': '8px 8px 0 0 rgb(var(--shadow-color) / 1)',
        'hard-sm-primary': '3px 3px 0 0 rgb(var(--color-primary) / 1)',
        'hard-sm-accent': '3px 3px 0 0 rgb(var(--color-accent) / 1)',
      },
    },
  },
  plugins: [],
};
