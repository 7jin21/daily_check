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
        <div
          key={s.title}
          className="bg-white dark:bg-slate-800 rounded-3xl p-4 border border-slate-100 dark:border-slate-700"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{s.icon}</span>
            <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">{s.title}</h3>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{s.content}</p>
        </div>
      ))}
    </div>
  )
}
