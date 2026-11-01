import { notFound } from 'next/navigation'
import ViewsPreview from './ViewsPreview'

// 開発専用: 下書き画面の待ち時間・清書中・保存のあとを、ログインや AI なしで確かめる（デザイン確認用。本番では 404）
// ?view=reading | generating | saved ／ &mood=1〜5 ／ &merged=1（追記） ／ &past=1（書き忘れた日）
export default async function DevViewsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; mood?: string; merged?: string; past?: string }>
}) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { view, mood, merged, past } = await searchParams
  const m = Number(mood)
  return (
    <ViewsPreview
      view={view === 'reading' || view === 'saved' ? view : 'generating'}
      mood={m >= 1 && m <= 5 ? m : 4}
      merged={merged === '1'}
      past={past === '1'}
    />
  )
}
