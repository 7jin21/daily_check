'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSettingsStore } from '@/stores/settings'
import { useCheckinStore } from '@/stores/checkin'
import { useMemoStore } from '@/stores/memos'
import { getSupabaseClient } from '@/lib/supabase'
import { apiGet, apiPost } from '@/lib/api-client'
import { clearUserLocalData } from '@/lib/constants'
import {
  isPushSupported,
  isPushConfigured,
  subscribeToPush,
  unsubscribeFromPush,
  unsubscribeThisDevice,
} from '@/lib/push-client'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { DownloadIcon, InfoIcon } from '@/components/ui/icons'

interface ServerSettings {
  hasNotionToken: boolean
  notionDatabaseId: string
  notificationTime: string
  timezone: string
}

export default function SettingsPage() {
  const router = useRouter()
  const { settings, updateSettings } = useSettingsStore()
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  // サーバー側設定（DB が唯一の真実 — /api/settings 経由で読み書き）
  const [hasNotionToken, setHasNotionToken] = useState(false)
  const [notionTokenInput, setNotionTokenInput] = useState('')   // 入力時のみ送信。常に空で開始
  const [notionDatabaseId, setNotionDatabaseId] = useState('')
  const [notificationTime, setNotificationTime] = useState('21:00')
  const [timezone, setTimezone] = useState('Asia/Tokyo')

  // 通知トグルの処理中・エラーメッセージ
  const [isTogglingPush, setIsTogglingPush] = useState(false)
  const [pushMessage, setPushMessage] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getSupabaseClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email ?? null)
    })

    apiGet<ServerSettings>('/api/settings')
      .then((server) => {
        setHasNotionToken(server.hasNotionToken)
        setNotionDatabaseId(server.notionDatabaseId)
        setNotificationTime(server.notificationTime)
        setTimezone(server.timezone)
      })
      .catch((err) => console.warn('設定の読み込みに失敗:', err))
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      await apiPost('/api/settings', {
        // トークンは入力があった場合のみ送信（undefined = 変更なし）
        ...(notionTokenInput.trim() ? { notionToken: notionTokenInput.trim() } : {}),
        notionDatabaseId,
        notificationTime,
        timezone,
      })

      if (notionTokenInput.trim()) {
        setHasNotionToken(true)
        setNotionTokenInput('')
      }
      setSaveMessage('設定を保存しました')
    } catch (err) {
      console.error('Settings save error:', err)
      setSaveMessage('保存に失敗しました')
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }

  const handleDisconnectNotion = async () => {
    setIsSaving(true)
    try {
      await apiPost('/api/settings', { notionToken: null, notionDatabaseId: '' })
      setHasNotionToken(false)
      setNotionTokenInput('')
      setNotionDatabaseId('')
      setSaveMessage('Notion連携を解除しました')
    } catch {
      setSaveMessage('解除に失敗しました')
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }

  // 通知トグル: Web Push の購読/解除を実際に行う
  const handleToggleNotifications = async () => {
    if (isTogglingPush || isSigningOut) return
    setPushMessage(null)

    // OFF にする
    if (settings.notificationsEnabled) {
      setIsTogglingPush(true)
      const result = await unsubscribeFromPush()
      if (result.ok) {
        updateSettings({ notificationsEnabled: false })
        setPushMessage('リマインダーをオフにしました')
      } else {
        setPushMessage('通知を停止できませんでした。接続を確認して、もう一度お試しください。')
      }
      setIsTogglingPush(false)
      return
    }

    // ON にする
    if (!isPushConfigured()) {
      setPushMessage('サーバー側の通知設定（VAPID キー）が未完了のため、現在リマインダーは利用できません。README のプッシュ通知セクションを参照してください。')
      return
    }
    if (!isPushSupported()) {
      setPushMessage('この環境では通知を利用できません。iPhone は iOS 16.4 以降で「ホーム画面に追加」したアプリから設定してください。')
      return
    }

    setIsTogglingPush(true)
    const result = await subscribeToPush()
    setIsTogglingPush(false)

    if (result.ok) {
      updateSettings({ notificationsEnabled: true })
      setPushMessage('この端末にリマインダーが届くようになりました（毎日21時ごろ・未記録の日のみ）')
    } else if (result.reason === 'denied') {
      setPushMessage('通知が許可されませんでした。ブラウザ / OS の通知設定を確認してください。')
    } else if (result.reason === 'not_configured') {
      setPushMessage('サーバー側の通知設定が未完了です。README のプッシュ通知セクションを参照してください。')
    } else {
      setPushMessage('通知の設定に失敗しました。時間をおいて再試行してください。')
    }
  }

  const handleSignOut = async () => {
    if (isSigningOut || isTogglingPush || isSaving) return
    setIsSigningOut(true)
    setSignOutError(null)
    try {
      // 認証が有効なうちに、この端末への通知が止まったことを確認する。
      const result = await unsubscribeThisDevice()
      if (!result.ok) throw new Error('通知を停止できませんでした。接続を確認して、もう一度お試しください。')
      updateSettings({ notificationsEnabled: false })
      const { error } = await getSupabaseClient().auth.signOut()
      if (error) throw new Error('サインアウトできませんでした。もう一度お試しください。')
      useCheckinStore.getState().reset()
      useSettingsStore.getState().reset()
      useMemoStore.getState().clear()
      clearUserLocalData()
      router.replace('/login')
      router.refresh()
    } catch (err) {
      setSignOutError(err instanceof Error ? err.message : 'サインアウトできませんでした。もう一度お試しください。')
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="px-5 pt-8 pb-8 space-y-6">
      <div className="section-head" style={{ borderBottomColor: 'var(--divider-strong)' }}>
        <div className="eyebrow">Settings</div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">設定</h1>
      </div>

      {/* アカウント情報 */}
      <div className="card">
        <h2 className="font-mincho font-semibold tracking-wide text-[var(--foreground)] mb-4">アカウント</h2>
        <div className="flex items-center gap-3">
          {/* 自分の印（金の輪の「私」） */}
          <div className="w-12 h-12 rounded-full bg-[var(--deep)] border border-[var(--gold)] flex items-center justify-center text-[var(--on-deep)] font-mincho text-lg" aria-hidden="true">
            私
          </div>
          <div>
            <p className="font-medium text-[var(--foreground)]">{userEmail ?? 'ログイン済み'}</p>
            <p className="text-sm text-[var(--muted)]">Inner Mirrorユーザー</p>
          </div>
        </div>
      </div>

      {/* 外観（テーマ） */}
      <div className="card">
        <h2 className="font-mincho font-semibold tracking-wide text-[var(--foreground)] mb-1">外観</h2>
        <p className="text-xs text-[var(--muted)] mb-4">
          この端末での表示テーマを選べます
        </p>
        <ThemeToggle />
      </div>

      {/* 通知設定 */}
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-mincho font-semibold tracking-wide text-[var(--foreground)]">通知</h2>
          <span className="text-[10px] text-[var(--muted-2)] tracking-wide">この端末の設定</span>
        </div>
        <p className="text-xs text-[var(--muted)] mb-4">
          記録がまだの日だけ、夜にそっとお知らせします
        </p>

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-medium text-[var(--foreground)]">毎日のリマインダー</p>
            <p className="text-sm text-[var(--muted)]">チェックインを忘れないように通知</p>
          </div>
          <button
            onClick={handleToggleNotifications}
            disabled={isTogglingPush || isSigningOut}
            className={`w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${
              settings.notificationsEnabled ? 'bg-[var(--primary)]' : 'bg-[var(--surface-secondary)] border border-[var(--border)]'
            }`}
            role="switch"
            aria-checked={settings.notificationsEnabled}
            aria-label="毎日のリマインダー"
          >
            <span
              className={`block w-5 h-5 rounded-full bg-[var(--surface)] shadow transition-transform mx-1 ${
                settings.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {pushMessage && (
          <div className="notice mb-4" role="status">
            <InfoIcon size={18} />
            <p>{pushMessage}</p>
          </div>
        )}

        {settings.notificationsEnabled && (
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
              通知時刻（目安）
            </label>
            <input
              type="time"
              value={notificationTime}
              onChange={(e) => setNotificationTime(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <p className="mt-1.5 text-xs text-[var(--muted-2)]">
              ※ 現在は毎日21時ごろの一斉配信です（時刻指定配信は準備中）
            </p>
          </div>
        )}

        <p className="mt-3 text-xs text-[var(--muted-2)] leading-relaxed">
          iPhone では「ホーム画面に追加」したアプリから設定してください（iOS 16.4以降）
        </p>
      </div>

      {/* Notion連携 */}
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-mincho font-semibold tracking-wide text-[var(--foreground)]">Notion連携</h2>
          {hasNotionToken && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium font-ui text-[var(--positive)]" style={{ background: 'color-mix(in srgb, var(--mood-5) 15%, transparent)' }}>
              連携中
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--muted)] mb-4">
          日記を自動的にNotionデータベースに同期します（アカウント設定・全端末共通）
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
              Notion APIトークン
            </label>
            <input
              type="password"
              value={notionTokenInput}
              onChange={(e) => setNotionTokenInput(e.target.value)}
              placeholder={hasNotionToken ? '設定済み（変更する場合のみ入力）' : 'secret_...'}
              className="w-full px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
              データベースID
            </label>
            <input
              type="text"
              value={notionDatabaseId}
              onChange={(e) => setNotionDatabaseId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
        </div>

        <div className="notice mt-3">
          <InfoIcon size={18} />
          <p>
            Notion API トークンは{' '}
            <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="underline" style={{ minHeight: 0, minWidth: 0, display: 'inline' }}>
              notion.so/my-integrations
            </a>{' '}
            から取得できます
          </p>
        </div>

        {hasNotionToken && (
          <button type="button" onClick={handleDisconnectNotion} disabled={isSaving} className="btn-quiet mt-2" data-tone="danger">
            連携を解除する
          </button>
        )}
      </div>

      {/* データ管理 */}
      <div className="card">
        <h2 className="font-mincho font-semibold tracking-wide text-[var(--foreground)] mb-1">データ</h2>
        <p className="text-xs text-[var(--muted)] mb-4">
          日記データはあなたのものです。いつでも持ち出せます
        </p>
        <div className="flex gap-3">
          <a href="/api/export?format=json" download className="btn btn-secondary flex-1">
            <DownloadIcon size={18} />
            JSON で保存
          </a>
          <a href="/api/export?format=csv" download className="btn btn-secondary flex-1">
            <DownloadIcon size={18} />
            CSV で保存
          </a>
        </div>
        <p className="mt-3 text-xs text-[var(--muted-2)]">
          個別の日記の削除は、各日記のページ下部から行えます
        </p>
      </div>

      {/* 保存ボタン */}
      <button type="button" onClick={handleSave} disabled={isSaving} className="btn btn-primary btn-block">
        {isSaving ? '保存しています…' : '設定を保存する'}
      </button>

      {saveMessage && (
        <p className="text-center text-sm font-ui text-[var(--primary)]" role="status">
          {saveMessage}
        </p>
      )}

      {/* サインアウト */}
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut || isTogglingPush || isSaving}
        className="btn btn-secondary btn-block"
        style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
      >
        {isSigningOut ? 'サインアウト中…' : 'サインアウト'}
      </button>
      {signOutError && <p className="text-sm" style={{ color: 'var(--danger)' }} role="alert">{signOutError}</p>}
    </div>
  )
}
