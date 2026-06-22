import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 暖色エディトリアル: テラコッタ／山吹のアクセント階調
        primary: {
          50: '#f6efe7',
          100: '#ecddcb',
          200: '#dcc2a3',
          300: '#cba27a',
          400: '#b8855c',
          500: '#9c6b4a',
          600: '#86583c',
          700: '#6c4630',
          800: '#523526',
          900: '#3a261b',
        },
        surface: {
          DEFAULT: '#f4efe6',
          dark: '#2a2622',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Schibsted Grotesk', 'Zen Kaku Gothic New', 'system-ui', 'sans-serif'],
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      },
    },
  },
  plugins: [],
}

export default config
