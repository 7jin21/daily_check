'use client'

import { useEffect, useState } from 'react'
import { getStoredTheme, setTheme, type Theme } from '@/lib/theme'
import { AutoThemeIcon, MoonIcon, SunIcon } from '@/components/ui/icons'

const OPTIONS: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: 'system', label: '自動', Icon: AutoThemeIcon },
  { value: 'light', label: 'ライト', Icon: SunIcon },
  { value: 'dark', label: 'ダーク', Icon: MoonIcon },
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
          className={`flex-1 py-2.5 rounded-full text-sm font-bold font-ui transition-colors flex items-center justify-center gap-1.5 ${
            theme === opt.value ? 'bg-[var(--btn-bg)] text-[var(--btn-fg)]' : 'text-[var(--muted)]'
          }`}
          aria-pressed={theme === opt.value}
        >
          <opt.Icon size={16} />
          {opt.label}
        </button>
      ))}
    </div>
  )
}
