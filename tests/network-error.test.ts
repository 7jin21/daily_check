import { describe, expect, it } from 'vitest'
import { isNetworkFailure, NetworkError } from '@/lib/network-error'
import { ApiError } from '@/lib/api-client'
import { classifyError, NETWORK_ERROR_MESSAGE, rewriteErrorMessage } from '@/components/draft/classify-error'

describe('isNetworkFailure', () => {
  it('ブラウザ・実行環境ごとの「通信に失敗した」例外を拾う', () => {
    expect(isNetworkFailure(new TypeError('Load failed'))).toBe(true) // iPhone の Safari
    expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true) // Chrome
    expect(isNetworkFailure(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(true) // Firefox
    expect(isNetworkFailure(new TypeError('fetch failed'))).toBe(true) // Node
    expect(isNetworkFailure(new NetworkError())).toBe(true)
  })

  it('Supabase が返す形（DB は「名前: 文言」の文字列、Auth は AuthRetryableFetchError）も拾う', () => {
    expect(isNetworkFailure({ message: 'TypeError: Load failed', details: '', hint: '', code: '' })).toBe(true)
    expect(isNetworkFailure({ message: 'FetchError: request to https://x.supabase.co failed' })).toBe(true)
    expect(isNetworkFailure({ name: 'AuthRetryableFetchError', message: 'Load failed', status: 0 })).toBe(true)
    // 502〜504 も Auth は同じ名前で返す（サーバーに届かなかった扱い）
    expect(isNetworkFailure({ name: 'AuthRetryableFetchError', message: 'Bad Gateway', status: 502 })).toBe(true)
  })

  it('未ログイン・入力の誤り・プログラムの不具合は通信の失敗にしない', () => {
    expect(isNetworkFailure(null)).toBe(false)
    expect(isNetworkFailure(undefined)).toBe(false)
    expect(isNetworkFailure(new Error('Unauthorized'))).toBe(false)
    expect(isNetworkFailure({ name: 'AuthSessionMissingError', message: 'Auth session missing!' })).toBe(false)
    expect(isNetworkFailure({ message: 'new row violates row-level security policy', code: '42501' })).toBe(false)
    expect(isNetworkFailure(new TypeError("Cannot read properties of undefined (reading 'id')"))).toBe(false)
    expect(isNetworkFailure('Load failed')).toBe(false) // 文字列そのものは例外ではない
  })
})

describe('classifyError（保存の失敗を利用者に見せる言葉）', () => {
  it('通信の失敗は「ネットワークに接続できません」（ログイン画面へ飛ばさない・英語を見せない）', () => {
    expect(classifyError(new NetworkError('Load failed'))).toBe(NETWORK_ERROR_MESSAGE)
    expect(classifyError(new TypeError('Load failed'))).toBe(NETWORK_ERROR_MESSAGE)
    // entry-save が Supabase のエラーを Error にしたときの文言
    expect(classifyError(new Error('TypeError: Load failed'))).toBe(NETWORK_ERROR_MESSAGE)
    expect(classifyError(new Error('TypeError: Failed to fetch'))).toBe(NETWORK_ERROR_MESSAGE)
    expect(NETWORK_ERROR_MESSAGE).not.toContain('セッション')
  })

  it('本当に未ログインのときだけ「セッション」（呼び出し側はログインへ移る）', () => {
    expect(classifyError(new Error('Unauthorized'))).toContain('セッション')
  })

  it('取り消しは何も見せず、そのほかは中身を見せる', () => {
    expect(classifyError(new DOMException('aborted', 'AbortError'))).toBe('cancelled')
    expect(classifyError(new Error('duplicate key value'))).toBe('duplicate key value')
    expect(classifyError('?')).toContain('保存に失敗しました')
  })
})

describe('rewriteErrorMessage（AI 書き直しの失敗）', () => {
  it('長すぎる（400 / 413）は理由をそのまま見せる（再試行しても同じなので「しばらくしてから」と言わない）', () => {
    expect(rewriteErrorMessage(new ApiError(400, '文章が長すぎます（2000字以内）'))).toBe('文章が長すぎます（2000字以内）')
    const cut = rewriteErrorMessage(new ApiError(413, '文章が長いため、書き直しが途中で切れました。短くしてからお試しください。'))
    expect(cut).toContain('短くして')
  })

  it('通信の失敗とそのほかの失敗', () => {
    expect(rewriteErrorMessage(new TypeError('Load failed'))).toBe(NETWORK_ERROR_MESSAGE)
    expect(rewriteErrorMessage(new ApiError(500, 'AI書き直しに失敗しました'))).toContain('しばらくしてから')
  })
})
