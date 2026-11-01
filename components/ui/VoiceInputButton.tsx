'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MicIcon, StopIcon } from '@/components/ui/icons'

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
  const onResultRef = useRef(onResult)
  const transcriptionRef = useRef<AbortController | null>(null)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true) // アンマウント後の state 更新・マイクリーク防止
  const startingRef = useRef(false) // getUserMedia 許可待ち中の二度押し再入防止
  const lifecycleRef = useRef(0) // 許可待ち中に画面が破棄された操作も無効にする

  // 録音・文字起こし中に手入力しても、最新の入力へ追記する。
  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

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

  // アンマウント時に録音・通信を止め、遅れて届いた結果を入力へ戻さない。
  useEffect(() => {
    mountedRef.current = true
    const lifecycle = lifecycleRef
    return () => {
      mountedRef.current = false
      lifecycle.current++
      startingRef.current = false
      transcriptionRef.current?.abort()
      transcriptionRef.current = null
      if (autoStopRef.current) clearTimeout(autoStopRef.current)
      autoStopRef.current = null
      const recorder = recorderRef.current
      recorderRef.current = null
      try {
        if (recorder) {
          recorder.ondataavailable = null
          recorder.onstop = null
          if (recorder.state === 'recording') recorder.stop()
        }
      } catch {
        // 既に停止済みなどは無視
      }
      releaseStream()
    }
  }, [releaseStream])

  // エラーメッセージは数秒で自動的に消す
  useEffect(() => {
    if (!errorMsg) return
    const t = setTimeout(() => setErrorMsg(null), 3500)
    return () => clearTimeout(t)
  }, [errorMsg])

  // 録音した Blob をサーバーへ送って文字起こし
  const transcribe = useCallback(
    async (blob: Blob, mime: string) => {
      if (!mountedRef.current) return
      transcriptionRef.current?.abort()
      const controller = new AbortController()
      transcriptionRef.current = controller
      const isCurrent = () =>
        mountedRef.current && !controller.signal.aborted && transcriptionRef.current === controller
      setStatus('transcribing')
      try {
        const form = new FormData()
        form.append('audio', blob, `recording.${extForMime(mime)}`)
        const res = await fetch('/api/transcribe', { method: 'POST', body: form, signal: controller.signal })
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null
          if (isCurrent()) setErrorMsg(data?.error ?? '文字起こしに失敗しました')
          return
        }
        const data = (await res.json()) as { text?: string }
        if (!isCurrent()) return
        const text = (data.text ?? '').trim()
        if (text) onResultRef.current(text)
        else setErrorMsg('音声が聞き取れませんでした')
      } catch {
        if (isCurrent()) setErrorMsg('通信に失敗しました')
      } finally {
        if (transcriptionRef.current === controller) {
          transcriptionRef.current = null
          if (mountedRef.current) setStatus('idle')
        }
      }
    },
    []
  )

  const startRecording = useCallback(async () => {
    // getUserMedia は非同期。許可待ちの間に再度押されても二重起動しない
    if (startingRef.current || recorderRef.current || transcriptionRef.current) return
    startingRef.current = true
    const lifecycle = lifecycleRef.current
    setErrorMsg(null)

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      if (lifecycle !== lifecycleRef.current) return
      startingRef.current = false
      const name = (err as DOMException)?.name ?? ''
      if (mountedRef.current) setErrorMsg(MEDIA_ERROR_MESSAGES[name] ?? 'マイクを起動できませんでした')
      return
    }

    // 許可待ちの間にアンマウントされていたら、取得したマイクを即解放して中断（リーク防止）
    if (!mountedRef.current || lifecycle !== lifecycleRef.current) {
      stream.getTracks().forEach((t) => t.stop())
      if (lifecycle === lifecycleRef.current) startingRef.current = false
      return
    }

    streamRef.current = stream
    const mime = pickMimeType()
    const chunks: Blob[] = []

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
      if (e.data.size > 0) chunks.push(e.data)
    }
    recorder.onstop = () => {
      if (recorderRef.current !== recorder) return
      recorderRef.current = null
      if (autoStopRef.current) {
        clearTimeout(autoStopRef.current)
        autoStopRef.current = null
      }
      releaseStream()
      const recordedMime = recorder.mimeType || mime || 'audio/webm'
      const blob = new Blob(chunks, { type: recordedMime })
      if (!mountedRef.current) return // アンマウント済みなら破棄（無駄な送信をしない）
      if (blob.size === 0) {
        setErrorMsg('録音できませんでした')
        setStatus('idle')
        return
      }
      void transcribe(blob, recordedMime)
    }

    recorderRef.current = recorder

    // start() 自体が例外を投げてもストリームを取り残さない
    try {
      recorder.start()
    } catch {
      recorderRef.current = null
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
    const recorder = recorderRef.current
    // stop() から onstop までの間に再度押されても、録音結果を捨てない。
    if (!recorder || recorder.state === 'inactive') return
    try {
      if (recorder.state === 'recording') {
        setStatus('transcribing')
        recorder.stop() // → onstop で文字起こしへ
        return
      }
    } catch {
      // 下のフォールバックで後始末
    }
    recorderRef.current = null
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
          className="absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-2xl bg-[var(--deep)] px-3 py-1.5 text-xs text-[var(--on-deep)] shadow-lg"
        >
          {errorMsg}
        </span>
      )}
      <button
        onClick={handleClick}
        type="button"
        disabled={status === 'transcribing'}
        aria-label={label}
        aria-pressed={status === 'recording'}
        className="voice-btn"
        data-status={status}
      >
        {status === 'transcribing' ? (
          <span className="spinner" style={{ width: 16, height: 16 }} />
        ) : status === 'recording' ? (
          <StopIcon size={16} />
        ) : (
          <MicIcon size={20} />
        )}
      </button>
    </div>
  )
}
