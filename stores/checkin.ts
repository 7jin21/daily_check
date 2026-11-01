import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from '@/lib/constants'
import type { DraftResult } from '@/lib/offline-draft'
import type { DraftMode } from '@/lib/draft-compose'

export interface CheckinInput {
  mood: number | null
  energy: number | null
  events: string
  challenges: string
  gratitude: string
  freeform: string
}

interface CheckinState extends CheckinInput {
  currentStep: number
  checkinDate: string | null   // "YYYY-MM-DD" (JST) — 入力を開始した日。日付が変わったら lib/checkin-rollover.ts で扱いを決める（言葉のある書きかけは消さない）
  targetDate: string | null    // 記録の対象日。null = 今日。過去日付の書き忘れ救済で使う
  draftResult: DraftResult | null
  editedDraft: string          // ユーザーが編集したドラフト（ナビゲーション間で保持）
  isGenerating: boolean
  draftIncomplete: boolean    // 生成途中の本文。再読み込み後も完成した清書と区別する
  resetVersion: number        // リセット以前の非同期応答で新しい入力を変更しないための世代
  reflectionQ: string          // AIが投げた内省の問い（任意）
  reflectionA: string          // それへのユーザーの回答（選択肢＋一言）
  draftMode: DraftMode         // 清書の整え方（原文のまま / 整える / 箇条書き）
  draftInputKey: string        // ドラフトを作ったときの入力（入力が変わったら清書し直すため）
  aiText: string               // この下書きで AI が出した文章（清書・書き直し）。「あなたの言葉」の判定に使う
  // Actions
  setMood: (mood: number) => void
  setEnergy: (energy: number) => void
  setEvents: (events: string) => void
  setChallenges: (challenges: string) => void
  setGratitude: (gratitude: string) => void
  setFreeform: (freeform: string) => void
  setCurrentStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  setCheckinDate: (date: string) => void
  setTargetDate: (date: string | null) => void
  setDraftResult: (result: DraftResult) => void
  setEditedDraft: (text: string) => void
  setIsGenerating: (isGenerating: boolean) => void
  setDraftIncomplete: (incomplete: boolean) => void
  setReflection: (question: string, answer: string) => void
  setDraftMode: (mode: DraftMode) => void
  setDraftInputKey: (key: string) => void
  addAiText: (text: string) => void // AI が出した文章を覚えておく（下書き画面で本人が書き足した言葉と区別するため）
  setAiText: (text: string) => void // 配信中のAI本文を累積重複させず更新する
  clearDraft: () => void       // ドラフトだけ捨てる（入力は残す）
  reset: () => void
  // Derived
  getInput: () => CheckinInput
}

const initialState: Omit<CheckinState, keyof Pick<CheckinState,
  'setMood' | 'setEnergy' | 'setEvents' | 'setChallenges' | 'setGratitude' |
  'setFreeform' | 'setCurrentStep' | 'nextStep' | 'prevStep' |
  'setCheckinDate' | 'setTargetDate' | 'setDraftResult' | 'setEditedDraft' | 'setIsGenerating' | 'setDraftIncomplete' |
  'setReflection' | 'setDraftMode' | 'setDraftInputKey' | 'addAiText' | 'setAiText' | 'clearDraft' | 'reset' | 'getInput'
>> = {
  mood: null,
  energy: null,
  events: '',
  challenges: '',
  gratitude: '',
  freeform: '',
  currentStep: 0,
  checkinDate: null,
  targetDate: null,
  draftResult: null,
  editedDraft: '',
  isGenerating: false,
  draftIncomplete: false,
  resetVersion: 0,
  reflectionQ: '',
  reflectionA: '',
  draftMode: 'tidy',
  draftInputKey: '',
  aiText: '',
}

export const useCheckinStore = create<CheckinState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setMood: (mood) => set({ mood }),
      setEnergy: (energy) => set({ energy }),
      setEvents: (events) => set({ events }),
      setChallenges: (challenges) => set({ challenges }),
      setGratitude: (gratitude) => set({ gratitude }),
      setFreeform: (freeform) => set({ freeform }),
      setCurrentStep: (step) => set({ currentStep: step }),
      nextStep: () => set((state) => ({ currentStep: state.currentStep + 1 })),
      prevStep: () => set((state) => ({ currentStep: Math.max(0, state.currentStep - 1) })),
      setCheckinDate: (checkinDate) => set({ checkinDate }),
      setTargetDate: (targetDate) => set({ targetDate }),
      setDraftResult: (draftResult) => set({ draftResult }),
      setEditedDraft: (editedDraft) => set({ editedDraft }),
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      setDraftIncomplete: (draftIncomplete) => set({ draftIncomplete }),
      setReflection: (reflectionQ, reflectionA) => set({ reflectionQ, reflectionA }),
      setDraftMode: (draftMode) => set({ draftMode }),
      setDraftInputKey: (draftInputKey) => set({ draftInputKey }),
      setAiText: (aiText) => set({ aiText }),
      addAiText: (text) =>
        set((state) => (text.trim() && !state.aiText.includes(text) ? { aiText: state.aiText ? `${state.aiText}\n${text}` : text } : {})),
      clearDraft: () => set((state) => ({
        draftResult: null, editedDraft: '', draftInputKey: '', draftMode: 'tidy', aiText: '',
        isGenerating: false, draftIncomplete: false, resetVersion: state.resetVersion + 1,
      })),

      reset: () => set((state) => ({ ...initialState, resetVersion: state.resetVersion + 1 })),

      getInput: () => {
        const state = get()
        return {
          mood: state.mood,
          energy: state.energy,
          events: state.events,
          challenges: state.challenges,
          gratitude: state.gratitude,
          freeform: state.freeform,
        }
      },
    }),
    {
      name: STORAGE_KEYS.CHECKIN_DRAFT,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<CheckinState>
        return {
          ...current,
          ...saved,
          isGenerating: false,
          resetVersion: current.resetVersion,
          draftIncomplete: saved.draftIncomplete ?? Boolean(saved.editedDraft && !saved.draftResult),
        }
      },
      partialize: (state) => ({
        mood: state.mood,
        energy: state.energy,
        events: state.events,
        challenges: state.challenges,
        gratitude: state.gratitude,
        freeform: state.freeform,
        currentStep: state.currentStep,
        checkinDate: state.checkinDate,
        targetDate: state.targetDate,
        draftResult: state.draftResult,
        editedDraft: state.editedDraft,
        reflectionQ: state.reflectionQ,
        reflectionA: state.reflectionA,
        draftMode: state.draftMode,
        draftInputKey: state.draftInputKey,
        aiText: state.aiText,
        draftIncomplete: state.draftIncomplete,
      }),
    }
  )
)
