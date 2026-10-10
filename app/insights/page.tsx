import LocalStatsSection from '@/components/insights/LocalStatsSection'
import AskSection from '@/components/insights/AskSection'
import WeeklyReportSection from '@/components/insights/WeeklyReportSection'
import AnalysisSection from '@/components/insights/AnalysisSection'

// インサイト画面。各セクションは互いに独立していて、状態と読み込みはそれぞれのコンポーネントが持つ
export default function InsightsPage() {
  return (
    <div className="px-5 pt-8 pb-8 space-y-6">
      <div className="section-head" style={{ borderBottomColor: 'var(--divider-strong)' }}>
        <div className="eyebrow">Insights</div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">インサイト</h1>
      </div>

      {/* ─── ローカル統計（即時表示） ─── */}
      <LocalStatsSection />

      {/* ─── AIに聞いてみる ─── */}
      <AskSection />

      {/* ─── 週次レポートセクション ─── */}
      <WeeklyReportSection />

      {/* ─── AI分析セクション ─── */}
      <AnalysisSection />
    </div>
  )
}
