import type { VRM } from '@pixiv/three-vrm'
import type { VRMHumanBoneName } from '@pixiv/three-vrm'

export interface WalkParams {
  legSwing: number
  kneeBend: number
  armSwing: number
  /** 腕を下ろす角度（Tポーズから） */
  armDown: number
  bodyBob: number
  lean: number
}

/**
 * VRM 用の手続き歩行。phase はラジアン、ratio は 0(停止)〜1(全速)。
 * 妹（ズシーン）も兄（走り）も同じ関数で、パラメータだけ変える。
 */
export function applyWalk(vrm: VRM, phase: number, ratio: number, p: WalkParams, modelHeight: number) {
  const h = vrm.humanoid
  const set = (name: VRMHumanBoneName, x: number, y = 0, z = 0) => {
    const n = h.getNormalizedBoneNode(name)
    if (n) n.rotation.set(x, y, z)
  }
  const s = Math.sin(phase)
  const swing = s * p.legSwing * ratio
  set('leftUpperLeg', swing)
  set('rightUpperLeg', -swing)
  set('leftLowerLeg', Math.max(0, -s) * p.kneeBend * ratio)
  set('rightLowerLeg', Math.max(0, s) * p.kneeBend * ratio)
  // VRM は +X が左。腕は Z 回転で下ろす（左は負、右は正）
  const arm = s * p.armSwing * ratio
  set('leftUpperArm', -arm, 0, -p.armDown)
  set('rightUpperArm', arm, 0, p.armDown)
  set('leftLowerArm', 0, 0, -0.25 - ratio * 0.6)
  set('rightLowerArm', 0, 0, 0.25 + ratio * 0.6)
  const hips = h.getNormalizedBoneNode('hips')
  if (hips) {
    const base = (hips.userData.baseY ??= hips.position.y) as number
    hips.position.y = base + Math.abs(Math.cos(phase)) * p.bodyBob * modelHeight * ratio
  }
  set('spine', p.lean * ratio)
}
