'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { saveFocus } from '@/lib/focus'
import { clearInsightsCaches, discardLegacyInsightsCaches, InsightsSession } from '@/lib/insights-session'

interface SessionContext {
  userId: string
  session: InsightsSession
}

const Context = createContext<SessionContext | null>(null)

export function useInsightsSession(): SessionContext {
  const context = useContext(Context)
  if (!context) throw new Error('InsightsSessionBoundary is required')
  return context
}

/** Switch accounts before rendering private results; invalidate old requests synchronously. */
export default function InsightsSessionBoundary({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<SessionContext | null>(null)

  useEffect(() => {
    const session = new InsightsSession()
    const supabase = getSupabaseClient()
    let disposed = false
    let authRevision = 0
    setIdentity(null)
    discardLegacyInsightsCaches()

    const changeUser = (userId: string | null) => {
      if (disposed) return
      const previousUser = session.currentUserId
      if (!session.changeUser(userId)) return
      if (previousUser) {
        clearInsightsCaches(previousUser)
        // A focus is personal too; do not carry the previous account's text into a new report.
        saveFocus(null)
      }
      setIdentity(userId ? { userId, session } : null)
    }

    // Keep the callback synchronous: Supabase holds its auth lock during delivery.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, authSession) => {
      authRevision++
      changeUser(authSession?.user.id ?? null)
    })
    const initialRevision = authRevision
    void supabase.auth.getUser().then(({ data: { user } }) => {
      // An earlier getUser response must not restore an account after SIGNED_OUT/SIGNED_IN.
      if (!disposed && authRevision === initialRevision) changeUser(user?.id ?? null)
    }).catch(() => { /* Auth events can still establish the current session. */ })

    return () => {
      disposed = true
      session.dispose()
      subscription.unsubscribe()
    }
  }, [])

  if (!identity) return null

  // Account changes also discard section state (cached results, input, and in-flight indicators).
  return <Context.Provider key={identity.userId} value={identity}>{children}</Context.Provider>
}
