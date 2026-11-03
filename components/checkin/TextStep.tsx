'use client'

import VoiceInputButton from '@/components/ui/VoiceInputButton'
import { NOTE_MAX_CHARS } from '@/stores/checkin'

interface TextStepProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  showHint?: boolean
  /** 読み上げ用の欄の名前（見えている見出しの id を渡す） */
  labelledBy?: string
}

// メモの入力欄（紙のように明朝で書ける。音声入力つき）
export default function TextStep({ value, onChange, placeholder, rows = 6, showHint = true, labelledBy }: TextStepProps) {
  const handleVoiceResult = (transcript: string) => {
    const next = value ? `${value} ${transcript}` : transcript
    onChange(next.slice(0, NOTE_MAX_CHARS))
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value.slice(0, NOTE_MAX_CHARS))
  }

  const remaining = NOTE_MAX_CHARS - value.length
  const isNearLimit = remaining <= 50

  return (
    <div>
      <div className="ck-textarea-wrap">
        <textarea
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          rows={rows}
          aria-labelledby={labelledBy}
          className="ck-textarea"
        />
        {/* 文字数（上限が近づいたら色を変えて知らせる） */}
        <span className="ck-counter" data-near={isNearLimit} aria-live={isNearLimit ? 'polite' : 'off'}>
          {isNearLimit ? `あと${remaining}字` : `${value.length}/${NOTE_MAX_CHARS}`}
        </span>
        <div className="ck-voice">
          <VoiceInputButton onResult={handleVoiceResult} />
        </div>
      </div>
      {showHint && <p className="ck-hint" data-align="start">キーワードや短い文でも、日記になります</p>}
    </div>
  )
}
