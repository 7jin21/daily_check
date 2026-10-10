// 清書から作ったタグ
export default function DraftTags({ tags }: { tags: string[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className="px-3 py-1 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--primary)] text-xs font-medium"
        >
          #{tag}
        </span>
      ))}
    </div>
  )
}
