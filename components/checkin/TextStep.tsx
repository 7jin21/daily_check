'use client'

import VoiceInputButton from '@/components/ui/VoiceInputButton'

const MAX_CHARS = 500

interface TextStepProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
}

export default function TextStep({ value, onChange, placeholder, required }: TextStepProps) {
  const handleVoiceResult = (transcript: string) => {
    const next = value ? `${value} ${transcript}` : transcript
    onChange(next.slice(0, MAX_CHARS))
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value.slice(0, MAX_CHARS))
  }

  const remaining = MAX_CHARS - value.length
  const isNearLimit = remaining <= 50

  return (
    <div className="space-y-3">
      <div className="relative">
        <textarea
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          rows={6}
          className="
            w-full p-4 pb-10 rounded-2xl border-2 border-slate-200 dark:border-slate-700
            bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100
            placeholder-slate-400 text-base resize-none
            focus:outline-none focus:border-sky-400 transition-colors
          "
          aria-required={required}
        />
        {/* 文字数カウンター */}
        <span
          className={`absolute bottom-3 left-4 text-xs tabular-nums ${
            isNearLimit ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'
          }`}
        >
          {value.length}/{MAX_CHARS}
        </span>
        <div className="absolute bottom-3 right-3">
          <VoiceInputButton onResult={handleVoiceResult} />
        </div>
      </div>
      <p className="text-xs text-slate-400 px-1">キーワードや短文でOK。音声入力も使えます 🎤</p>
    </div>
  )
}
