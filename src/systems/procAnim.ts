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
  /** 肘を曲げずにピンと伸ばす（子どもの行進風） */
  straightArms: boolean
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
  const elbow = p.straightArms ? 0.05 : 0.25 + ratio * 0.6
  set('leftLowerArm', 0, 0, -elbow)
  set('rightLowerArm', 0, 0, elbow)
  const hips = h.getNormalizedBoneNode('hips')
  if (hips) {
    const base = (hips.userData.baseY ??= hips.position.y) as number
    hips.position.y = base + Math.abs(Math.cos(phase)) * p.bodyBob * modelHeight * ratio
  }
  set('spine', p.lean * ratio)
}

const lerpTo = (n: { rotation: { x: number; y: number; z: number } } | null, x: number, y: number, z: number, k: number) => {
  if (!n) return
  n.rotation.x += (x - n.rotation.x) * k
  n.rotation.y += (y - n.rotation.y) * k
  n.rotation.z += (z - n.rotation.z) * k
}

/**
 * 肩上ポーズ。steer=null で腕組み、0 で前を指す、-1/1 で左右を指す。
 * VRM の腕は Tポーズ基準。左腕は +X 方向に伸びる。
 */
export function applyShoulderPose(vrm: VRM, steer: number | null, dt: number) {
  const h = vrm.humanoid
  const k = Math.min(1, 12 * dt)
  const b = (n: VRMHumanBoneName) => h.getNormalizedBoneNode(n)
  // 脚は直立、体は少し反らす
  lerpTo(b('leftUpperLeg'), 0, 0, 0, k)
  lerpTo(b('rightUpperLeg'), 0, 0, 0, k)
  lerpTo(b('leftLowerLeg'), 0, 0, 0, k)
  lerpTo(b('rightLowerLeg'), 0, 0, 0, k)
  lerpTo(b('spine'), -0.12, 0, 0, k)
  const hips = b('hips')
  if (hips) {
    const base = (hips.userData.baseY ??= hips.position.y) as number
    hips.position.y = base
  }
  if (steer === null) {
    // 腕組み：上腕を下ろして前へ、前腕を胸の前で交差
    lerpTo(b('leftUpperArm'), -0.9, 0, -1.15, k)
    lerpTo(b('rightUpperArm'), -0.9, 0, 1.15, k)
    lerpTo(b('leftLowerArm'), 0, -2.3, -0.3, k)
    lerpTo(b('rightLowerArm'), 0, 2.3, 0.3, k)
    return
  }
  // 右腕で指差し。前=0、左右は yaw で振る
  const yaw = steer * 1.1
  lerpTo(b('rightUpperArm'), -1.5, yaw, 0.1, k)
  lerpTo(b('rightLowerArm'), 0, 0, 0, k)
  // 左腕は腰に
  lerpTo(b('leftUpperArm'), -0.3, 0, -1.2, k)
  lerpTo(b('leftLowerArm'), 0, -1.6, -0.2, k)
}

/** 子どもっぽい笑顔＋まばたき。walkRatio が高いほど口が開く */
export function applyFace(vrm: VRM, t: number, walkRatio: number, f: { happy: number; mouthOpen: number; mouthOpenWalk: number; blinkPeriod: number }) {
  const em = vrm.expressionManager
  if (!em) return
  em.setValue('happy', f.happy)
  const open = f.mouthOpen + (f.mouthOpenWalk - f.mouthOpen) * walkRatio
  // 歩調に合わせて口をわずかにパクつかせる
  em.setValue('aa', Math.max(0, open + Math.sin(t * 6) * 0.08 * walkRatio))
  const b = (t % f.blinkPeriod) / f.blinkPeriod
  em.setValue('blink', b > 0.95 ? Math.sin((b - 0.95) / 0.05 * Math.PI) : 0)
}
