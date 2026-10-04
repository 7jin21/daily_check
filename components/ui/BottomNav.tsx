'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// 画面下に浮かぶカプセル型ナビゲーション。アイコンは「水鏡」に合わせた細線。
const NAV_ITEMS = [
  { href: '/', icon: MirrorIcon, label: 'ホーム' },
  { href: '/entries', icon: PagesIcon, label: '一覧' },
  { href: '/insights', icon: WaveIcon, label: 'インサイト' },
  { href: '/settings', icon: DialIcon, label: '設定' },
]

export default function BottomNav() {
  const pathname = usePathname()

  // ログインページ・チェックイン・ドラフトページではナビを非表示
  const hideNav = ['/login', '/auth', '/checkin', '/draft'].some((path) => pathname.startsWith(path))

  if (hideNav) return null

  return (
    <nav className="nav-float" aria-label="メインメニュー">
      <div className="nav-capsule">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className="nav-item"
              data-active={isActive}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon />
              <span className="nav-label">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

const iconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** 水平線に映る月 */
function MirrorIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="8.5" r="4" />
      <path d="M3.5 14.5h17" />
      <path d="M7.5 18h9" opacity="0.7" />
      <path d="M10 21h4" opacity="0.45" />
    </svg>
  )
}

/** 重なった頁 */
function PagesIcon() {
  return (
    <svg {...iconProps}>
      <rect x="6" y="3.5" width="12.5" height="16" rx="1.8" />
      <path d="M3.5 7v12.2a1.8 1.8 0 0 0 1.8 1.8H15" />
      <path d="M9.5 8.5h5.5M9.5 12h5.5M9.5 15.5h3" />
    </svg>
  )
}

/** 気分の波 */
function WaveIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 15.5c2.2-6 4.6-6 6.4-1.6 1.6 4 4 4 5.6-.6 1.4-4 3.6-5 6-2.3" />
      <path d="M3 20.5h18" opacity="0.45" />
    </svg>
  )
}

/** 調整つまみ */
function DialIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 7.5h9M17 7.5h3" />
      <circle cx="15" cy="7.5" r="2" />
      <path d="M4 16.5h3M11 16.5h9" />
      <circle cx="9" cy="16.5" r="2" />
    </svg>
  )
}
