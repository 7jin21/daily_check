import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

// DB に保存するシークレット（Notion トークン等）の暗号化ユーティリティ
// ENCRYPTION_KEY 未設定時は平文のまま保存する（開発用フォールバック）

const PREFIX = 'enc:v1:'

function getKey(): Buffer | null {
  const secret = process.env.ENCRYPTION_KEY
  if (!secret) return null
  return createHash('sha256').update(secret).digest()
}

export function encryptSecret(plain: string): string {
  const key = getKey()
  if (!key) return plain
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptSecret(stored: string): string {
  // 平文（旧データ / ENCRYPTION_KEY 未使用時）はそのまま返す
  if (!stored.startsWith(PREFIX)) return stored
  const key = getKey()
  if (!key) throw new Error('ENCRYPTION_KEY is not set — 暗号化済みデータを復号できません')
  const buf = Buffer.from(stored.slice(PREFIX.length), 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const encrypted = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
