'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DialIcon, MirrorMark, PagesIcon, WaveIcon } from '@/components/ui/icons'

// 画面下に浮かぶカプセル型ナビゲーション。アイコンは「水鏡」に合わせた細線（24px・線幅 1.5）。
const NAV_ITEMS = [
  { href: '/', icon: <MirrorMark size={24} strokeWidth={1.5} />, label: 'ホーム' },
  { href: '/entries', icon: <PagesIcon size={24} />, label: '一覧' },
  { href: '/insights', icon: <WaveIcon size={24} />, label: 'インサイト' },
  { href: '/settings', icon: <DialIcon size={24} />, label: '設定' },
]

export default function BottomNav() {
  const pathname = usePathname()

  // ログインページ・チェックイン・ドラフトページではナビを非表示
  const hideNav = ['/login', '/auth', '/checkin', '/draft', '/dev/views'].some((path) => pathname.startsWith(path))

  if (hideNav) return null

  return (
    <nav className="nav-float" aria-label="メインメニュー">
      <div className="nav-capsule">
        {NAV_ITEMS.map(({ href, icon, label }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className="nav-item"
              data-active={isActive}
              aria-current={isActive ? 'page' : undefined}
            >
              {icon}
              <span className="nav-label">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
