/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans"', 'sans-serif'],
        display: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      colors: {
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
      },
    },
  },
  plugins: [],
};
