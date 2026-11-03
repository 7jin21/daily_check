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
      // 色は app/globals.css の CSS 変数（text-[var(--primary)] など）だけを使う
      fontFamily: {
        sans: ['Cormorant Garamond', 'Shippori Mincho', 'Hiragino Mincho ProN', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
