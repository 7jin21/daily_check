import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from '@/lib/constants'

// このストアは「この端末だけの設定」のみを保持する。
// Notion トークン・DB ID・通知時刻・タイムゾーンなどサーバーに保存する設定は
// /api/settings 経由で profiles テーブルに保存する（DB が唯一の真実）。

export interface ClientSettings {
  notificationsEnabled: boolean
  googleCalendarEnabled: boolean
}

interface SettingsState {
  settings: ClientSettings
  updateSettings: (updates: Partial<ClientSettings>) => void
  reset: () => void
}

const defaultSettings: ClientSettings = {
  notificationsEnabled: false,
  googleCalendarEnabled: false,
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,

      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),

      reset: () => set({ settings: defaultSettings }),
    }),
    {
      name: STORAGE_KEYS.SETTINGS,
    }
  )
)
