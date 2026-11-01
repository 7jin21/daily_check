import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from '@/lib/constants'
import { jstTimeHM, todayJST } from '@/lib/jst'
import { memosUsedIn } from '@/lib/memo-insert'

// 日中の「ひとこと」メモ（時刻つき）。夜のチェックインで選んで日記に入れる。
// この端末の localStorage にだけ保存し、日付が変わったら持ち越さない（その日の素材なので）。

export interface Memo {
  id: string
  time: string // HH:MM (JST)
  text: string
}

export const MEMO_MAX_ITEMS = 20
export const MEMO_MAX_CHARS = 140

interface MemoState {
  date: string | null // メモの日付 YYYY-MM-DD (JST)
  items: Memo[]
  add: (text: string) => void
  remove: (id: string) => void
  /** 日記に入ったメモだけを片付ける（入りきらなかった・選ばなかったメモは、その日のうちは残す） */
  removeUsedIn: (text: string) => void
  clear: () => void
}

/** 今日のメモだけを返す（前日の残りは無視） */
export function todaysMemos(state: { date: string | null; items: Memo[] }, today: string): Memo[] {
  return state.date === today ? state.items : []
}

export const useMemoStore = create<MemoState>()(
  persist(
    (set, get) => ({
      date: null,
      items: [],
      add: (raw) => {
        const text = raw.trim().slice(0, MEMO_MAX_CHARS)
        if (!text) return
        const today = todayJST()
        const current = get().date === today ? get().items : []
        const memo: Memo = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: jstTimeHM(), text }
        // 新しいものを上に
        set({ date: today, items: [memo, ...current].slice(0, MEMO_MAX_ITEMS) })
      },
      remove: (id) => set({ items: get().items.filter((m) => m.id !== id) }),
      removeUsedIn: (text) => {
        const used = new Set(memosUsedIn(get().items, text).map((m) => m.id))
        if (used.size) set({ items: get().items.filter((m) => !used.has(m.id)) })
      },
      clear: () => set({ date: null, items: [] }),
    }),
    { name: STORAGE_KEYS.MEMOS }
  )
)
