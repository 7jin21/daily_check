'use client'

import { useEffect, useState } from 'react'
import { getStoredTheme, setTheme, type Theme } from '@/lib/theme'

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'system', label: '自動', icon: '🌓' },
  { value: 'light', label: 'ライト', icon: '☀️' },
  { value: 'dark', label: 'ダーク', icon: '🌙' },
]

export default function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>('system')

  useEffect(() => {
    setThemeState(getStoredTheme())
  }, [])

  return (
    <div className="flex gap-1 p-1 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)]">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => {
            setTheme(opt.value)
            setThemeState(opt.value)
          }}
          className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
            theme === opt.value ? 'bg-[var(--accent)] text-[#f7f4ea]' : 'text-[var(--muted)]'
          }`}
          aria-pressed={theme === opt.value}
        >
          <span aria-hidden="true">{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </div>
  )
}
