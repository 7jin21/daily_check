'use client'

import { useEffect, useState } from 'react'
import { STORAGE_KEYS } from '@/lib/constants'
import Wbr from '@/components/ui/Wbr'

// 「|」は折り返してよい文節の切れ目（components/ui/Wbr.tsx）
const MILESTONES: Record<number, string> = {
  3: '三日、|続きました。',
  7: '一週間、|続きました。',
  14: '二週間。|もう習慣に|なっています。',
  30: 'ひと月、|毎日|映してきました。',
  50: '五十日。|積み重ねが|形に|なってきました。',
  60: '六十日。|続けることが|力に|なっています。',
  80: '八十日。|百日まで、|あと少し。',
  100: '百日。|ここまでの|自分を|誇ってください。',
}

// 連続記録の節目の知らせ。和紙のシートの冒頭に、その日のあいだだけ置く。
// （以前は画面の下に数秒浮かべていたため、「この一週間」の丸と日付を隠し、見逃すと二度と出なかった）
// 節目に初めて着いた日を覚えておき、その日のうちは何度開いても出す。翌日からは出さない。
export default function StreakCelebration({ streak, today }: { streak: number; today: string }) {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const msg = MILESTONES[streak]
    if (!msg) return
    const key = `${STORAGE_KEYS.MILESTONE_PREFIX}${streak}`
    try {
      const seen = localStorage.getItem(key)
      // 以前の版は '1' を保存していた（＝もう見た節目）。その節目は出し直さない
      if (seen && seen !== today) return
      if (!seen) localStorage.setItem(key, today)
    } catch {
      return
    }
    setMessage(msg)
  }, [streak, today])

  if (!message) return null

  return (
    <div className="im-milestone" role="status">
      <span className="im-milestone-count" aria-hidden="true">
        {streak}
      </span>
      <span className="im-milestone-body">
        <span className="im-label">
          <span className="sr-only">連続 {streak} </span>日、続けて記録しています
        </span>
        <span className="im-milestone-text">
          <Wbr text={message} />
        </span>
      </span>
    </div>
  )
}
