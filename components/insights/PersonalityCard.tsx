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

export default function PersonalityCard({ analysis }: PersonalityCardProps) {
  const sections = [
    { icon: '🧠', title: 'タイプ', content: `${analysis.personalityType} — ${analysis.description}` },
    { icon: '💪', title: '強み', content: analysis.strengths.join(' / ') },
    { icon: '🌱', title: '成長ポイント', content: analysis.growthAreas.join(' / ') },
    { icon: '💛', title: '感情パターン', content: analysis.emotionalPatterns.join(' / ') },
  ]

  return (
    <div className="space-y-3">
      {sections.map((s) => (
        <div key={s.title} className="card" style={{ padding: 16 }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{s.icon}</span>
            <h3 className="font-bold text-[var(--foreground)] text-sm">{s.title}</h3>
          </div>
          <p className="text-[var(--muted)] text-sm leading-relaxed">{s.content}</p>
        </div>
      ))}
    </div>
  )
}
