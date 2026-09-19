import type { VRM } from '@pixiv/three-vrm'
import { preset } from './quality'

/**
 * VRM の毎フレーム更新を品質プリセットに合わせて軽くする。
 * - 髪の物理（スプリングボーン）は springEvery フレームに 1 回だけ計算（飛ばした分の時間をまとめて渡す）
 * - トゥーンの輪郭線（MToon の outline メッシュ＝キャラをもう 1 回描く）は outline=false なら非表示
 */
type OutlineMat = { isOutline?: boolean; visible: boolean }
const frameOf = new WeakMap<VRM, number>()
const springAcc = new WeakMap<VRM, number>()
const outlineApplied = new WeakMap<VRM, boolean>()

export function vrmUpdate(vrm: VRM, dt: number) {
  const p = preset()
  // 輪郭線の表示（プリセットが変わった時だけ触る）
  if (outlineApplied.get(vrm) !== p.outline) {
    outlineApplied.set(vrm, p.outline)
    // three-vrm は輪郭線を「同じメッシュの追加マテリアル（isOutline）」として描く。
    // マテリアルの visible を落とせばその描画パスだけ飛ばせる
    vrm.scene.traverse((o) => {
      const m = o as { isMesh?: boolean; material?: OutlineMat | OutlineMat[] }
      if (!m.isMesh || !m.material) return
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) if (mat.isOutline) mat.visible = p.outline
    })
  }
  const every = Math.max(1, p.springEvery)
  if (every === 1) {
    vrm.update(dt)
    return
  }
  const f = (frameOf.get(vrm) ?? 0) + 1
  frameOf.set(vrm, f)
  const acc = (springAcc.get(vrm) ?? 0) + dt
  if (f % every === 0) {
    vrm.update(acc)
    springAcc.set(vrm, 0)
  } else {
    // 髪以外（ポーズ・表情・視線）は毎フレーム反映する
    springAcc.set(vrm, acc)
    vrm.humanoid.update()
    vrm.expressionManager?.update()
    vrm.lookAt?.update(dt)
    vrm.nodeConstraintManager?.update()
  }
}
