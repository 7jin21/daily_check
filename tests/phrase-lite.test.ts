import { describe, expect, it } from 'vitest'
import { phrasesLite } from '@/components/ui/PhraseLite'

describe('ブラウザ用の軽い文節分け（phrasesLite）', () => {
  const samples = [
    '仕様変更で午後は作り直し。前提を確認してほしかった',
    'それを大事にしたかったのは、なぜだと思いますか？',
    '「前提を確認してほしかった」と思った',
    '部長に資料を褒められてちょっと嬉しい一日',
  ]

  it('分けても文字は1つも増減しない', () => {
    for (const s of samples) expect(phrasesLite(s).join('')).toBe(s)
  })

  it('助詞・句読点・閉じかっこで行が始まらない', () => {
    for (const s of samples) {
      for (const chunk of phrasesLite(s).slice(1)) {
        expect(chunk).not.toMatch(/^[をはがにでともへやの、。」』）]/)
      }
    }
  })

  it('助詞は前の語につながる（「前提を」が切れない）', () => {
    expect(phrasesLite('前提を確認してほしかった')).toContain('前提を')
  })

  it('読点のあとは、ひらがなで始まる語でも新しいかたまりにする', () => {
    const chunks = phrasesLite('残ったのは、どんな場面でしたか？')
    expect(chunks.some((c) => c.startsWith('どんな'))).toBe(true)
  })

  it('開きかっこは次の語に付く', () => {
    expect(phrasesLite('「前提を確認」')[0].startsWith('「前提')).toBe(true)
  })

  it('空の文は空', () => {
    expect(phrasesLite('')).toEqual([])
  })
})
