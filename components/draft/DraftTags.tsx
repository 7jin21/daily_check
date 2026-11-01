// 清書から作ったタグ
export default function DraftTags({ tags }: { tags: string[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-2" aria-label="タグ">
      {tags.map((tag) => (
        <li key={tag} className="tag-pill">
          #{tag}
        </li>
      ))}
    </ul>
  )
}
