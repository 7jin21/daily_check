import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from '@/lib/constants'
import type { DraftResult } from '@/lib/offline-draft'

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
  checkinDate: string | null   // "YYYY-MM-DD" (JST) — 入力を開始した日。別日なら自動リセット
  targetDate: string | null    // 記録の対象日。null = 今日。過去日付の書き忘れ救済で使う
  draftResult: DraftResult | null
  editedDraft: string          // ユーザーが編集したドラフト（ナビゲーション間で保持）
  isGenerating: boolean
  reflectionQ: string          // AIが投げた内省の問い（任意）
  reflectionA: string          // それへのユーザーの回答（選択肢＋一言）
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
  setReflection: (question: string, answer: string) => void
  reset: () => void
  // Derived
  getInput: () => CheckinInput
}

const initialState: Omit<CheckinState, keyof Pick<CheckinState,
  'setMood' | 'setEnergy' | 'setEvents' | 'setChallenges' | 'setGratitude' |
  'setFreeform' | 'setCurrentStep' | 'nextStep' | 'prevStep' |
  'setCheckinDate' | 'setTargetDate' | 'setDraftResult' | 'setEditedDraft' | 'setIsGenerating' |
  'setReflection' | 'reset' | 'getInput'
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
  reflectionQ: '',
  reflectionA: '',
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
      setReflection: (reflectionQ, reflectionA) => set({ reflectionQ, reflectionA }),

      reset: () => set({ ...initialState }),

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
      }),
    }
  )
)
