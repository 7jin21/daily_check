import { AlertIcon } from '@/components/ui/icons'

export type DraftNoticeKind = 'offline' | 'partial'

// 清書が AI で作れなかった・途中で止まったことを伝える
export default function DraftNotice({ kind }: { kind: DraftNoticeKind }) {
  return (
    <div className="notice mb-4" data-tone="warn" role="status">
      <AlertIcon size={18} />
      {kind === 'offline' ? (
        <p>
          <b>AI に接続できませんでした</b>
          書いたメモをそのまま使っています。「整える」を押すと清書を再試行します。
        </p>
      ) : (
        <p>
          <b>清書が途中で止まりました</b>
          続きは手で直すか、「清書し直す」を押してください。
        </p>
      )}
    </div>
  )
}
