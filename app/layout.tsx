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
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
}

/**
 * iPhone の「文字サイズ」（設定 → 画面表示と明るさ → テキストサイズ / アクセシビリティ → さらに大きな文字）に合わせて、
 * 画面の文字の基準（1rem）を変える。Safari は既定の 16px をこの設定で変えないため、
 * システム本文の大きさ（-apple-system-body。標準で 17px）を測って比率を出す。
 * 画面が崩れないよう 0.875〜1.3 倍に収める。iPhone / iPad だけ（Mac の Safari は本文が 13px で小さくなりすぎるため対象外）。
 * アプリに戻ってきたとき（設定を変えて戻ったとき）にも測り直す。
 */
const DYNAMIC_TYPE_SCRIPT = `(function(){try{var d=document.documentElement,u=navigator.userAgent;if(!(/iP(hone|ad|od)/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1)))return;if(!(window.CSS&&CSS.supports('font','-apple-system-body')))return;var a=function(){var p=document.createElement('div');p.style.cssText='font:-apple-system-body;position:absolute;visibility:hidden;pointer-events:none';d.appendChild(p);var s=parseFloat(getComputedStyle(p).fontSize);d.removeChild(p);if(!s)return;var r=Math.min(1.3,Math.max(0.875,s/17));d.style.fontSize=Math.abs(r-1)<0.01?'':(16*r).toFixed(2)+'px'};a();document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')a()})}catch(e){}})()`

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
        {/* 文字の大きさを iPhone の設定（Dynamic Type）に合わせる。描画の前に決めて、ちらつかせない */}
        <script dangerouslySetInnerHTML={{ __html: DYNAMIC_TYPE_SCRIPT }} />
        {/* PWA / iPhone 対応 meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Inner Mirror" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* 書体: 欧文・数字 Cormorant Garamond ／ 和文 Shippori Mincho（明朝）／ 小さな UI 文字 Zen Kaku Gothic New */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,500&family=Shippori+Mincho:wght@500;600;700;800&family=Zen+Kaku+Gothic+New:wght@500;700&display=swap"
          rel="stylesheet"
        />
        {/* テーマカラー: ライト＝和紙 / ダーク＝墨 */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f3efe6" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#141612" />
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
