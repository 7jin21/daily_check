import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNav from '@/components/ui/BottomNav'
import AddToHomeScreenBanner from '@/components/ui/AddToHomeScreenBanner'
import ServiceWorkerRegister from '@/components/ui/ServiceWorkerRegister'

export const metadata: Metadata = {
  title: 'Inner Mirror',
  description: '毎日の気づきを記録する日記アプリ',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Inner Mirror',
  },
  icons: {
    apple: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        {/* ダークモード初期化スクリプト（フラッシュ防止） */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var d=document.documentElement,t=localStorage.getItem('inner-mirror-theme');if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches)){d.classList.add('dark')}else{d.classList.remove('dark')}}catch(e){}})()` }} />
        {/* PWA / iPhone 対応 meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Inner Mirror" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* ボタニカル: 欧文 Cormorant Garamond ＋ 和文 Shippori Mincho（上質な日記帳の明朝体） */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Shippori+Mincho:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* テーマカラー: ライト＝クリーム / ダーク＝深い森 */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f2efe6" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#20241b" />
      </head>
      <body>
        {/* Service Worker 登録（静的アセットのオフラインキャッシュ） */}
        <ServiceWorkerRegister />
        {/* iOS "ホーム画面に追加" ガイドバナー */}
        <AddToHomeScreenBanner />
        {/* メインコンテンツ */}
        <main className="page-content">
          {children}
        </main>
        {/* ボトムナビゲーション */}
        <BottomNav />
      </body>
    </html>
  )
}
