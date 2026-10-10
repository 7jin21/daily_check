// 下書き画面の待ち時間の表示（内省の問いを待つ間・清書の生成中）

/** 内省の問いを待っている間（先読み済みならほぼ出ない。最大7秒で清書へ進む） */
export function ReadingView() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 gap-6">
      <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      <p className="text-[var(--muted-2)] text-sm">今日の記録を読んでいます…</p>
    </div>
  )
}

/** 清書の生成中。届いた文字があれば、書かれていく様子をそのまま見せる */
export function GeneratingView({ text, onCancel }: { text: string; onCancel: () => void }) {
  // ストリーミング中: 文字が書かれていく様子をリアルタイム表示
  if (text) {
    return (
      <div className="min-h-dvh flex flex-col px-4 pt-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="spinner" style={{ width: 20, height: 20 }} />
          <h1 className="text-lg font-bold text-[var(--foreground)]">あなたの言葉を清書しています…</h1>
        </div>
        <div className="card flex-1 mb-4 overflow-y-auto">
          <p className="text-base text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">
            {text}
            <span className="typing-cursor" aria-hidden="true" />
          </p>
        </div>
        <div className="pb-6">
          <button
            onClick={onCancel}
            className="w-full py-3 rounded-full border border-[var(--border)] text-[var(--muted)] text-sm"
          >
            キャンセルして入力に戻る
          </button>
        </div>
      </div>
    )
  }

  // 最初のトークンが届くまでの待機画面
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 gap-6">
      <div className="spinner" style={{ width: 48, height: 48, borderWidth: 3 }} />
      <div className="text-center">
        <p className="font-bold text-[var(--foreground)] text-lg">あなたの言葉を清書しています…</p>
        <p className="text-[var(--muted-2)] text-sm mt-1">言い回しはそのまま、つなぎだけ整えます</p>
      </div>
      <button
        onClick={onCancel}
        className="px-6 py-3 rounded-full border border-[var(--border)] text-[var(--muted)] text-sm"
      >
        キャンセルして入力に戻る
      </button>
    </div>
  )
}
