const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTs } = require('./helpers.cjs')

function signoutFixture({ removalOk = true, authError = null } = {}) {
  const calls = []
  const settingsStore = Object.assign(() => ({ settings: { notificationsEnabled: true }, updateSettings: () => calls.push('settings-off') }), { getState: () => ({ reset: () => calls.push('settings-reset') }) })
  const page = loadTs('app/settings/page.tsx', {
    react: { useState: (value) => [value, () => {}], useEffect: () => {} },
    'next/navigation': { useRouter: () => ({ replace: (url) => calls.push(['replace', url]), refresh: () => calls.push('refresh') }) },
    '@/stores/settings': { useSettingsStore: settingsStore },
    '@/stores/checkin': { useCheckinStore: { getState: () => ({ reset: () => calls.push('draft-reset') }) } },
    '@/stores/memos': { useMemoStore: { getState: () => ({ clear: () => calls.push('memos-clear') }) } },
    '@/lib/supabase': { getSupabaseClient: () => ({ auth: { signOut: async () => { calls.push('auth-signout'); return { error: authError } } } }) },
    '@/lib/api-client': {},
    '@/lib/constants': { clearUserLocalData: () => calls.push('clear-local') },
    '@/lib/push-client': { unsubscribeThisDevice: async () => { calls.push('push-remove'); return { ok: removalOk } } },
    '@/components/ui/ThemeToggle': () => null,
  }).default
  function findButton(node) {
    if (!node || typeof node !== 'object') return null
    if (node.type === 'button' && node.props.children === 'サインアウト') return node
    for (const child of [node.props?.children].flat(Infinity)) {
      const result = findButton(child)
      if (result) return result
    }
    return null
  }
  return { click: findButton(page()).props.onClick, calls }
}

test('settings removes push while authenticated, then clears user data and leaves', async () => {
  const { click, calls } = signoutFixture()
  await click()
  assert.deepEqual(calls, ['push-remove', 'settings-off', 'auth-signout', 'draft-reset', 'settings-reset', 'memos-clear', 'clear-local', ['replace', '/login'], 'refresh'])
})

test('failed push removal does not sign out or falsely clear local data', async () => {
  const { click, calls } = signoutFixture({ removalOk: false })
  await click()
  assert.deepEqual(calls, ['push-remove'])
})

test('failed auth signout does not display success or discard drafts', async () => {
  const { click, calls } = signoutFixture({ authError: { message: 'offline' } })
  await click()
  assert.deepEqual(calls, ['push-remove', 'settings-off', 'auth-signout'])
})
