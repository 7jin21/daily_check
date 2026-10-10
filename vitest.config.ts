import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// 単体テストの設定。対象は lib/ の純粋関数（DOM は使わないので node 環境）。
// '@/…' の import は tsconfig の paths と同じくプロジェクト直下を指す
const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: { '@': root },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
