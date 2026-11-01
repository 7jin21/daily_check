'use client'

interface AnalysisResult {
  personalityType: string
  description: string
  strengths: string[]
  growthAreas: string[]
  emotionalPatterns: string[]
}

interface PersonalityCardProps {
  analysis: AnalysisResult
}

// 分析の4つの見出し。絵文字の代わりに、ホームのセクションと同じ番号と細罫で組む
export default function PersonalityCard({ analysis }: PersonalityCardProps) {
  const sections = [
    { title: 'タイプ', content: `${analysis.personalityType} — ${analysis.description}` },
    { title: '強み', content: analysis.strengths.join(' / ') },
    { title: '伸びしろ', content: analysis.growthAreas.join(' / ') },
    { title: '気持ちの動き方', content: analysis.emotionalPatterns.join(' / ') },
  ]

  return (
    <div className="card" style={{ padding: '6px 20px' }}>
      <dl>
        {sections.map((s, i) => (
          <div key={s.title} className="py-4" style={i > 0 ? { borderTop: '1px solid var(--hairline)' } : undefined}>
            <dt className="flex items-baseline gap-3">
              <span className="font-display italic text-[0.9375rem] text-[var(--faint)]" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="label-ui">{s.title}</span>
            </dt>
            <dd className="mt-1.5 font-mincho text-[0.9375rem] leading-loose text-[var(--foreground)] prose-ja">{s.content}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
