'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSettingsStore } from '@/stores/settings'
import { getSupabaseClient } from '@/lib/supabase'
import { apiGet, apiPost } from '@/lib/api-client'

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
    router.push('/login')
  }

  return (
    <div className="px-4 pt-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">設定</h1>

      {/* アカウント情報 */}
      <div className="card">
        <h2 className="font-semibold text-slate-700 dark:text-slate-300 mb-4">アカウント</h2>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white text-xl">
            👤
          </div>
          <div>
            <p className="font-medium text-slate-800 dark:text-slate-200">{userEmail ?? 'ログイン済み'}</p>
            <p className="text-sm text-slate-500">Inner Mirrorユーザー</p>
          </div>
        </div>
      </div>

      {/* Notion連携 */}
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-slate-700 dark:text-slate-300">Notion連携</h2>
          {hasNotionToken && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
              連携中
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-4">
          日記を自動的にNotionデータベースに同期します
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              Notion APIトークン
            </label>
            <input
              type="password"
              value={notionTokenInput}
              onChange={(e) => setNotionTokenInput(e.target.value)}
              placeholder={hasNotionToken ? '設定済み（変更する場合のみ入力）' : 'secret_...'}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              データベースID
            </label>
            <input
              type="text"
              value={notionDatabaseId}
              onChange={(e) => setNotionDatabaseId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>
        </div>

        <div className="mt-3 p-3 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 text-xs">
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
        <h2 className="font-semibold text-slate-700 dark:text-slate-300 mb-4">通知</h2>

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-medium text-slate-700 dark:text-slate-300">毎日のリマインダー</p>
            <p className="text-sm text-slate-500">チェックインを忘れないように通知</p>
          </div>
          <button
            onClick={() => updateSettings({ notificationsEnabled: !settings.notificationsEnabled })}
            className={`w-12 h-7 rounded-full transition-colors ${
              settings.notificationsEnabled ? 'bg-sky-500' : 'bg-slate-200 dark:bg-slate-700'
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
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              通知時刻
            </label>
            <input
              type="time"
              value={notificationTime}
              onChange={(e) => setNotificationTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>
        )}
      </div>

      {/* 保存ボタン */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-sky-400 to-violet-500 text-white font-bold text-lg disabled:opacity-40 active:scale-95 transition-transform"
      >
        {isSaving ? '保存中...' : '設定を保存'}
      </button>

      {saveMessage && (
        <p className="text-center text-sm text-green-600 dark:text-green-400">{saveMessage}</p>
      )}

      {/* サインアウト */}
      <button
        onClick={handleSignOut}
        className="w-full py-4 rounded-2xl border border-red-200 dark:border-red-800 text-red-500 font-medium text-base active:scale-95 transition-transform"
      >
        サインアウト
      </button>
    </div>
  )
}
