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
        // ボタニカル・セレニティ: セージグリーンのアクセント階調
        primary: {
          50: '#f2f4ea',
          100: '#e2e8d3',
          200: '#c8d3b0',
          300: '#acbb8d',
          400: '#8ba375',
          500: '#5f7a4c',
          600: '#4f673f',
          700: '#405434',
          800: '#324128',
          900: '#242f1d',
        },
        surface: {
          DEFAULT: '#faf8f1',
          dark: '#2a2f23',
        },
      },
      fontFamily: {
        sans: ['Cormorant Garamond', 'Shippori Mincho', 'Hiragino Mincho ProN', 'serif'],
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
