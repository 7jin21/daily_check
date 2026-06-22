'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSettingsStore } from '@/stores/settings'
import { useCheckinStore } from '@/stores/checkin'
import { getSupabaseClient } from '@/lib/supabase'
import { apiGet, apiPost } from '@/lib/api-client'
import { clearUserLocalData } from '@/lib/constants'

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

  // サーバー側設定（DB が唯一の真実 — /api/settings 経由で読み書き）
  const [hasNotionToken, setHasNotionToken] = useState(false)
  const [notionTokenInput, setNotionTokenInput] = useState('')   // 入力時のみ送信。常に空で開始
  const [notionDatabaseId, setNotionDatabaseId] = useState('')
  const [notificationTime, setNotificationTime] = useState('21:00')
  const [timezone, setTimezone] = useState('Asia/Tokyo')

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
      setSaveMessage('設定を保存しました ✓')
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

  const handleSignOut = async () => {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
    // 共有端末対策: 前ユーザーの下書き・AI分析キャッシュ等を残さない
    useCheckinStore.getState().reset()
    useSettingsStore.getState().reset()
    clearUserLocalData()
    router.push('/login')
  }

  return (
    <div className="px-5 pt-8 space-y-6">
      <div className="section-head" style={{ borderBottomColor: 'var(--divider-strong)' }}>
        <div className="eyebrow">Settings</div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">設定</h1>
      </div>

      {/* アカウント情報 */}
      <div className="card">
        <h2 className="font-bold text-[var(--foreground)] mb-4">アカウント</h2>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#2a2622] border border-[var(--accent)] flex items-center justify-center text-[#e9ddc7] text-xl">
            👤
          </div>
          <div>
            <p className="font-medium text-[var(--foreground)]">{userEmail ?? 'ログイン済み'}</p>
            <p className="text-sm text-[var(--muted)]">Inner Mirrorユーザー</p>
          </div>
        </div>
      </div>

      {/* Notion連携 */}
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-[var(--foreground)]">Notion連携</h2>
          {hasNotionToken && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#6f8a5f]/15 text-[#5a7350] dark:text-[#9caa7e] font-medium">
              連携中
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--muted)] mb-4">
          日記を自動的にNotionデータベースに同期します
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
              className="w-full px-4 py-3 rounded-[3px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
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
              className="w-full px-4 py-3 rounded-[3px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
        </div>

        <div className="mt-3 p-3 rounded-[3px] bg-[var(--surface-secondary)] text-[var(--muted)] text-xs">
          📝 Notion API トークンは{' '}
          <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="underline">
            notion.so/my-integrations
          </a>{' '}
          から取得できます
        </div>

        {hasNotionToken && (
          <button
            onClick={handleDisconnectNotion}
            disabled={isSaving}
            className="mt-3 text-xs text-red-500 underline disabled:opacity-40"
          >
            連携を解除する
          </button>
        )}
      </div>

      {/* 通知設定 */}
      <div className="card">
        <h2 className="font-bold text-[var(--foreground)] mb-4">通知</h2>

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-medium text-[var(--foreground)]">毎日のリマインダー</p>
            <p className="text-sm text-[var(--muted)]">チェックインを忘れないように通知</p>
          </div>
          <button
            onClick={() => updateSettings({ notificationsEnabled: !settings.notificationsEnabled })}
            className={`w-12 h-7 rounded-full transition-colors ${
              settings.notificationsEnabled ? 'bg-[var(--primary)]' : 'bg-[var(--surface-secondary)] border border-[var(--border)]'
            }`}
            role="switch"
            aria-checked={settings.notificationsEnabled}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-1 ${
                settings.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {settings.notificationsEnabled && (
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
              通知時刻
            </label>
            <input
              type="time"
              value={notificationTime}
              onChange={(e) => setNotificationTime(e.target.value)}
              className="w-full px-4 py-3 rounded-[3px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
        )}
      </div>

      {/* 保存ボタン */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-4 rounded-[2px] bg-[var(--accent)] text-[#2a2622] font-bold text-base disabled:opacity-40 active:scale-[0.99] transition-transform"
      >
        {isSaving ? '保存中...' : '設定を保存'}
      </button>

      {saveMessage && (
        <p className="text-center text-sm text-[var(--primary)]">{saveMessage}</p>
      )}

      {/* サインアウト */}
      <button
        onClick={handleSignOut}
        className="w-full py-4 rounded-[2px] border border-[#b5654a]/40 text-[#9c4a2f] dark:text-[#d39177] font-medium text-base active:scale-[0.99] transition-transform"
      >
        サインアウト
      </button>
    </div>
  )
}
