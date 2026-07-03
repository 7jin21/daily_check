'use client'

import VoiceInputButton from '@/components/ui/VoiceInputButton'

const MAX_CHARS = 500

interface TextStepProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  showHint?: boolean
}

export default function TextStep({ value, onChange, placeholder, rows = 6, showHint = true }: TextStepProps) {
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
          rows={rows}
          className="
            w-full p-4 pb-10 rounded-2xl border border-[var(--border)]
            bg-[var(--surface)] text-[var(--foreground)]
            placeholder:text-[var(--muted-2)] text-base resize-none
            focus:outline-none focus:border-[var(--primary)] transition-colors
          "
        />
        {/* 文字数カウンター */}
        <span
          className={`absolute bottom-3 left-4 text-xs tabular-nums ${
            isNearLimit ? 'text-[#a4683f]' : 'text-[var(--muted-2)]'
          }`}
        >
          {value.length}/{MAX_CHARS}
        </span>
        <div className="absolute bottom-3 right-3">
          <VoiceInputButton onResult={handleVoiceResult} />
        </div>
      </div>
      {showHint && (
        <p className="text-xs text-[var(--muted-2)] px-1">キーワードや短文でOK。音声入力も使えます 🎤</p>
      )}
    </div>
  )
}
