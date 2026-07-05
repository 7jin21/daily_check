// テーマ管理（layout.tsx のフラッシュ防止インラインスクリプトと同じキー・同じロジックを共有する）

export type Theme = 'light' | 'dark' | 'system'

const THEME_KEY = 'inner-mirror-theme'

/** 保存されているテーマ設定を返す（未設定 = システム追従） */
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(THEME_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

/** 現在のテーマ設定を <html> の .dark クラスへ反映する */
export function applyTheme(theme: Theme) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

/** テーマを保存し、即座に画面へ反映する */
export function setTheme(theme: Theme) {
  if (theme === 'system') {
    localStorage.removeItem(THEME_KEY)
  } else {
    localStorage.setItem(THEME_KEY, theme)
  }
  applyTheme(theme)
}
