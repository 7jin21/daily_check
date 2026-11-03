import type { ReactNode, SVGProps } from 'react'

// アプリ全体で使う細線のアイコン（ボトムナビと同じ線: 24px 格子・線幅 1.5・端は丸）。
// 絵文字は端末ごとに絵柄が変わり、明朝と細線の世界観から浮くので、画面の中ではこちらを使う。
// 飾りとして使うのが基本なので aria-hidden。意味を持たせるときは、ボタン側に aria-label を付ける。

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number }

function Icon({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </Icon>
)

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" />
  </Icon>
)

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5.5 9.5 12 16l6.5-6.5" />
  </Icon>
)

export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 12h14.5M13.5 6.5 19 12l-5.5 5.5" />
  </Icon>
)

export const ArrowLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19.5 12H5M10.5 6.5 5 12l5.5 5.5" />
  </Icon>
)

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
  </Icon>
)

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
)

export const MicIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21M9 21h6" />
  </Icon>
)

export const StopIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" />
  </Icon>
)

/** 清書する（筆） */
export const PenIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15.2 4.8a2.1 2.1 0 0 1 3 3L8.6 17.4 4.5 18.6l1.2-4.1z" />
    <path d="m13.5 6.5 3 3" />
  </Icon>
)

export const RefreshIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.3-5.4" />
    <path d="M19.5 4.5v4h-4" />
  </Icon>
)

export const UndoIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 6.5 4.5 11 9 15.5" />
    <path d="M4.5 11h10a4.5 4.5 0 0 1 0 9H11" />
  </Icon>
)

export const AlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v5.5" />
    <circle cx="12" cy="16.3" r="0.6" fill="currentColor" />
  </Icon>
)

export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="7.8" r="0.6" fill="currentColor" />
  </Icon>
)

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
  </Icon>
)

/** iPhone の「共有」ボタンと同じ形（ホーム画面に追加の案内で使う） */
export const ShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5v11M8 7.5l4-4 4 4" />
    <path d="M8.5 10.5H7A1.5 1.5 0 0 0 5.5 12v7A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1.5" />
  </Icon>
)

export const ImageIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="m20 15.5-4.5-4.5L8 18.5" />
  </Icon>
)

export const BellIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Icon>
)

export const SunIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
  </Icon>
)

export const MoonIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z" />
  </Icon>
)

/** 自動（半分だけ明るい円） */
export const AutoThemeIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
  </Icon>
)

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Icon>
)

export const TrendUpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4 16.5 5-5 3.5 3.5L20 7.5" />
    <path d="M15 7.5h5v5" />
  </Icon>
)

export const TrendFlatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12h15" />
    <path d="m15.5 8 4 4-4 4" />
  </Icon>
)

export const TrendDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4 7.5 5 5 3.5-3.5L20 16.5" />
    <path d="M20 11.5v5h-5" />
  </Icon>
)

/** 重なった頁（ナビの「一覧」） */
export const PagesIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6" y="3.5" width="12.5" height="16" rx="1.8" />
    <path d="M3.5 7v12.2a1.8 1.8 0 0 0 1.8 1.8H15" />
    <path d="M9.5 8.5h5.5M9.5 12h5.5M9.5 15.5h3" />
  </Icon>
)

/** 気分の波（ナビの「インサイト」） */
export const WaveIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 15.5c2.2-6 4.6-6 6.4-1.6 1.6 4 4 4 5.6-.6 1.4-4 3.6-5 6-2.3" />
    <path d="M3 20.5h18" opacity="0.45" />
  </Icon>
)

/** 調整つまみ（ナビの「設定」） */
export const DialIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7.5h9M17 7.5h3" />
    <circle cx="15" cy="7.5" r="2" />
    <path d="M4 16.5h3M11 16.5h9" />
    <circle cx="9" cy="16.5" r="2" />
  </Icon>
)

/** このアプリの印: 水平線に映る月（ナビの「ホーム」と同じ形）。空の状態・ログイン・エラーで使う */
export const MirrorMark = ({ size = 40, ...p }: IconProps) => (
  <Icon size={size} strokeWidth={1.2} {...p}>
    <circle cx="12" cy="8.5" r="4" />
    <path d="M3.5 14.5h17" />
    <path d="M7.5 18h9" opacity="0.7" />
    <path d="M10 21h4" opacity="0.45" />
  </Icon>
)
