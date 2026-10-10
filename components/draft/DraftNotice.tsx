export type DraftNoticeKind = 'offline' | 'partial'

// 清書が AI で作れなかった・途中で止まったことを伝える
export default function DraftNotice({ kind }: { kind: DraftNoticeKind }) {
  return (
    <div
      className="mb-4 p-3 rounded-2xl text-sm"
      style={{ background: 'rgba(197,137,95,0.12)', border: '1px solid rgba(197,137,95,0.35)', color: '#a4683f' }}
    >
      {kind === 'offline' ? (
        <>
          <p className="font-semibold">AI に接続できませんでした</p>
          <p className="mt-0.5 text-xs">書いたメモをそのまま使っています。「整える」を押すと清書を再試行します。</p>
        </>
      ) : (
        <>
          <p className="font-semibold">清書が途中で止まりました</p>
          <p className="mt-0.5 text-xs">続きは手で直すか、「清書し直す」を押してください。</p>
        </>
      )}
    </div>
  )
}
