import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // 親ディレクトリに無関係な package-lock.json があっても
  // このプロジェクトをワークスペースルートとして扱う
  outputFileTracingRoot: path.join(__dirname),
  // PWA headers + セキュリティヘッダー
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          // iframe 埋め込みを禁止（クリックジャッキング対策）
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // 音声入力(マイク)は使うので無効化しない
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=()' },
        ],
      },
    ]
  },
  // Allow images from Supabase storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
}

export default nextConfig
