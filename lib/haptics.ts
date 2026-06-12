// 触覚フィードバック（対応端末のみ。iOS Safari は未対応だが呼んでも無害）
export function hapticTap() {
  try {
    navigator.vibrate?.(10)
  } catch {
    // 非対応環境では何もしない
  }
}
