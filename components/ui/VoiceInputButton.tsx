'use client'

import { useState, useRef, useEffect } from 'react'

interface VoiceInputButtonProps {
  onResult: (transcript: string) => void
}

// Web Speech API は TypeScript の標準型定義に含まれないため最小限の型を定義
interface SpeechRecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechRecognitionResultEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export default function VoiceInputButton({ onResult }: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    setIsSupported(!!getSpeechRecognition())
  }, [])

  const toggle = () => {
    const SR = getSpeechRecognition()
    if (!SR) return

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const recognition = new SR()
    recognition.lang = 'ja-JP'
    recognition.continuous = false      // iOS は false 推奨
    recognition.interimResults = false

    recognition.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? ''
      if (transcript) onResult(transcript)
    }

    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  if (!isSupported) return null

  return (
    <button
      onClick={toggle}
      type="button"
      aria-label={isListening ? '録音停止' : '音声入力'}
      className={`
        w-11 h-11 rounded-full flex items-center justify-center transition-all
        ${isListening
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
        }
      `}
    >
      🎤
    </button>
  )
}
