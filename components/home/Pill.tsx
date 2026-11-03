import type { ReactNode } from 'react'
import Link from 'next/link'

// 水面の上の、矢印つきの丸いボタン（ホームの呼びかけ・初回の「最初の記録をする」）
export default function Pill({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="im-pill">
      {children}
      <span className="im-pill-arrow">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  )
}
