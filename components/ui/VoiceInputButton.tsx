'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface VoiceInputButtonProps {
  onResult: (transcript: string) => void
}

// 録音方式: MediaRecorder で音声を録り、/api/transcribe（Groq Whisper）へ送って文字起こしする。
// Web Speech API は iOS standalone PWA で動かない（赤いまま固まる）ため、全環境で動くこの方式に変更。

// 録音できる MIME を環境に合わせて選ぶ（iOS は mp4、その他は webm が一般的）
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  for (const c of ['audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return undefined // ブラウザ既定に任せる
}

function extForMime(mime: string | undefined): string {
  if (!mime) return 'webm'
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

// getUserMedia のエラー名 → 日本語メッセージ
const MEDIA_ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError: 'マイクの使用が許可されていません',
  SecurityError: 'マイクの使用が許可されていません',
  NotFoundError: 'マイクが見つかりません',
  NotReadableError: 'マイクを使用できません（他のアプリが使用中かも）',
}

// 暴走防止：これを超えたら自動停止
const MAX_RECORDING_MS = 60_000

type Status = 'idle' | 'recording' | 'transcribing'

export default function VoiceInputButton({ onResult }: VoiceInputButtonProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [isSupported, setIsSupported] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mimeRef = useRef<string | undefined>(undefined)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true) // アンマウント後の state 更新・マイクリーク防止
  const startingRef = useRef(false) // getUserMedia 許可待ち中の二度押し再入防止

  useEffect(() => {
    setIsSupported(
      typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== 'undefined'
    )
  }, [])

  // マイク（ストリーム）を解放する
  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  // アンマウント時に録音とマイクを確実に止める
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (autoStopRef.current) clearTimeout(autoStopRef.current)
      try {
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      } catch {
        // 既に停止済みなどは無視
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // エラーメッセージは数秒で自動的に消す
  useEffect(() => {
    if (!errorMsg) return
    const t = setTimeout(() => setErrorMsg(null), 3500)
    return () => clearTimeout(t)
  }, [errorMsg])

  // 録音した Blob をサーバーへ送って文字起こし
  const transcribe = useCallback(
    async (blob: Blob) => {
      setStatus('transcribing')
      try {
        const form = new FormData()
        form.append('audio', blob, `recording.${extForMime(mimeRef.current)}`)
        const res = await fetch('/api/transcribe', { method: 'POST', body: form })
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null
          if (mountedRef.current) setErrorMsg(data?.error ?? '文字起こしに失敗しました')
          return
        }
        const data = (await res.json()) as { text?: string }
        const text = (data.text ?? '').trim()
        if (text) onResult(text)
        else if (mountedRef.current) setErrorMsg('音声が聞き取れませんでした')
      } catch {
        if (mountedRef.current) setErrorMsg('通信に失敗しました')
      } finally {
        if (mountedRef.current) setStatus('idle')
      }
    },
    [onResult]
  )

  const startRecording = useCallback(async () => {
    // getUserMedia は非同期。許可待ちの間に再度押されても二重起動しない
    if (startingRef.current || recorderRef.current?.state === 'recording') return
    startingRef.current = true
    setErrorMsg(null)

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      startingRef.current = false
      const name = (err as DOMException)?.name ?? ''
      if (mountedRef.current) setErrorMsg(MEDIA_ERROR_MESSAGES[name] ?? 'マイクを起動できませんでした')
      return
    }

    // 許可待ちの間にアンマウントされていたら、取得したマイクを即解放して中断（リーク防止）
    if (!mountedRef.current) {
      stream.getTracks().forEach((t) => t.stop())
      startingRef.current = false
      return
    }

    streamRef.current = stream
    const mime = pickMimeType()
    mimeRef.current = mime
    chunksRef.current = []

    let recorder: MediaRecorder
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
    } catch {
      releaseStream()
      startingRef.current = false
      setErrorMsg('録音を開始できませんでした')
      return
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      if (autoStopRef.current) {
        clearTimeout(autoStopRef.current)
        autoStopRef.current = null
      }
      releaseStream()
      const blob = new Blob(chunksRef.current, { type: mimeRef.current || 'audio/webm' })
      chunksRef.current = []
      if (!mountedRef.current) return // アンマウント済みなら破棄（無駄な送信をしない）
      if (blob.size === 0) {
        setErrorMsg('録音できませんでした')
        setStatus('idle')
        return
      }
      void transcribe(blob)
    }

    recorderRef.current = recorder

    // start() 自体が例外を投げてもストリームを取り残さない
    try {
      recorder.start()
    } catch {
      releaseStream()
      startingRef.current = false
      setErrorMsg('録音を開始できませんでした')
      return
    }

    startingRef.current = false
    setStatus('recording')

    // 暴走防止の自動停止
    autoStopRef.current = setTimeout(() => {
      try {
        if (recorder.state === 'recording') recorder.stop()
      } catch {
        // 無視
      }
    }, MAX_RECORDING_MS)
  }, [releaseStream, transcribe])

  const stopRecording = useCallback(() => {
    try {
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.stop() // → onstop で文字起こしへ
        return
      }
    } catch {
      // 下のフォールバックで後始末
    }
    releaseStream()
    setStatus('idle')
  }, [releaseStream])

  const handleClick = () => {
    if (status === 'idle') startRecording()
    else if (status === 'recording') stopRecording()
    // transcribing 中は無視（ボタンも disabled）
  }

  if (!isSupported) return null

  const label =
    status === 'recording' ? '録音停止' : status === 'transcribing' ? '文字起こし中' : '音声入力'

  return (
    <div className="relative">
      {errorMsg && (
        <span
          role="status"
          className="absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-slate-800 px-2 py-1 text-xs text-white shadow-lg"
        >
          {errorMsg}
        </span>
      )}
      <button
        onClick={handleClick}
        type="button"
        disabled={status === 'transcribing'}
        aria-label={label}
        className={`
          w-11 h-11 rounded-full flex items-center justify-center transition-all
          ${
            status === 'recording'
              ? 'bg-red-500 text-white animate-pulse'
              : status === 'transcribing'
                ? 'bg-slate-200 dark:bg-slate-600 text-slate-400 cursor-wait'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
          }
        `}
      >
        {status === 'transcribing' ? (
          <span className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
        ) : (
          '🎤'
        )}
      </button>
    </div>
  )
}
