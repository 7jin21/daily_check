import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // 親ディレクトリに無関係な package-lock.json があっても
  // このプロジェクトをワークスペースルートとして扱う
  outputFileTracingRoot: path.join(__dirname),
  // PWA headers
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
