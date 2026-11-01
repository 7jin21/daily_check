// 気分とエネルギーを図形で表すための計算（描画の部品から使う純粋関数）。
// 気分 = 月の満ち欠け（光っている部分が多いほど、気分がいい）
// エネルギー = 器の水位（「枯渇」は水が干上がりかけ、「最高」は縁までなみなみ）
// 色だけに頼らず形でも区別できるので、色の見え方に関係なく読める。

/** 気分（1〜5）の月の明るい部分の割合。3（普通）がちょうど半月、5 が満月。1 でも細い光は残す */
const MOOD_LIGHT = [0.12, 0.3, 0.5, 0.74, 1] as const

/** エネルギー（1〜5）の水位（器の高さに対する割合）。3（普通）がちょうど半分 */
const ENERGY_LEVEL = [0.14, 0.32, 0.5, 0.68, 0.88] as const

const isScale = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5

/** 気分 → 月の明るい部分の割合（0〜1）。範囲外なら null */
export function moodLight(mood: number | null | undefined): number | null {
  return isScale(mood) ? MOOD_LIGHT[mood - 1] : null
}

/** エネルギー → 水位（0〜1）。範囲外なら null */
export function energyLevel(energy: number | null | undefined): number | null {
  return isScale(energy) ? ENERGY_LEVEL[energy - 1] : null
}

const f2 = (n: number) => (Math.abs(n) < 0.005 ? '0' : n.toFixed(2))

/**
 * 中心 (0,0)・半径 r の月の、明るい部分の SVG パス（右から満ちていく形）。
 * lit = 0 は新月（面積なし）、0.5 は半月、1 は満月。
 * 右半分の縁を半円で描き、明暗の境目（楕円の弧）で戻る。lib/almanac.ts の moonLitPath と同じ描き方。
 */
export function moonPhasePath(lit: number, r: number): string {
  const f = Math.min(1, Math.max(0, lit))
  const rx = Math.abs(1 - 2 * f) * r
  // 半月より細いときは境目が光る側（右）へ、太いときは反対側（左）へふくらむ
  const termSweep = f < 0.5 ? 0 : 1
  return `M 0 ${f2(-r)} A ${f2(r)} ${f2(r)} 0 0 1 0 ${f2(r)} A ${f2(rx)} ${f2(r)} 0 0 ${termSweep} 0 ${f2(-r)} Z`
}

/**
 * 中心 (0,0)・半径 r の丸い器に、高さの割合 level まで入った水の SVG パス。
 * 水面はゆるく波打たせる（wave は波の高さ。r に対する割合）。
 */
export function waterPath(level: number, r: number, wave = 0.07): string {
  const l = Math.min(0.999, Math.max(0.001, level))
  const h = r - 2 * r * l // 水面の y（下向きが正）
  const x = Math.sqrt(Math.max(0, r * r - h * h))
  const a = r * wave
  // 水面の下が円の半分より大きいときは、大きい方の弧で回る
  const large = h < 0 ? 1 : 0
  return `M ${f2(-x)} ${f2(h)} Q ${f2(-x / 2)} ${f2(h - a)} 0 ${f2(h)} T ${f2(x)} ${f2(h)} A ${f2(r)} ${f2(r)} 0 ${large} 1 ${f2(-x)} ${f2(h)} Z`
}
