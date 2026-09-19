import type { VRM } from '@pixiv/three-vrm'
import type { VRMHumanBoneName } from '@pixiv/three-vrm'
import * as THREE from 'three'

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

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
/**
 * 左腕がモデルローカルでどちらを向いているか（+1 = +X、-1 = -X）。
 * VRM 0.x と 1.0 で逆になるので、腕の回転符号をこれで合わせる。初回に実測してキャッシュ。
 */
export function armSign(vrm: VRM): number {
  const cached = vrm.scene.userData.armSign as number | undefined
  if (cached !== undefined) return cached
  const up = vrm.humanoid.getNormalizedBoneNode('leftUpperArm')
  const lo = vrm.humanoid.getNormalizedBoneNode('leftLowerArm')
  if (!up || !lo) return 1
  vrm.scene.updateMatrixWorld(true)
  up.getWorldPosition(_a)
  lo.getWorldPosition(_b)
  vrm.scene.worldToLocal(_a)
  vrm.scene.worldToLocal(_b)
  const sgn = _b.x - _a.x >= 0 ? 1 : -1
  vrm.scene.userData.armSign = sgn
  return sgn
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
  // 腕は Z 回転で下ろす。左右の向きは armSign で吸収（VRM0/1 の差）
  const g = armSign(vrm)
  const arm = s * p.armSwing * ratio
  set('leftUpperArm', -arm * g, 0, -p.armDown * g)
  set('rightUpperArm', arm * g, 0, p.armDown * g)
  const elbow = p.straightArms ? 0.05 : 0.25 + ratio * 0.6
  set('leftLowerArm', 0, 0, -elbow * g)
  set('rightLowerArm', 0, 0, elbow * g)
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
  const g = armSign(vrm)
  if (steer === null) {
    // 腕組み：上腕を下ろして前へ、前腕を胸の前で交差
    lerpTo(b('leftUpperArm'), -0.9 * g, 0, -1.15 * g, k)
    lerpTo(b('rightUpperArm'), -0.9 * g, 0, 1.15 * g, k)
    lerpTo(b('leftLowerArm'), 0, -2.3 * g, -0.3 * g, k)
    lerpTo(b('rightLowerArm'), 0, 2.3 * g, 0.3 * g, k)
    return
  }
  // 右腕で指差し。前=0、左右は yaw で振る
  const yaw = steer * 1.1
  lerpTo(b('rightUpperArm'), -1.5 * g, yaw, 0.1 * g, k)
  lerpTo(b('rightLowerArm'), 0, 0, 0, k)
  // 左腕は腰に
  lerpTo(b('leftUpperArm'), -0.3 * g, 0, -1.2 * g, k)
  lerpTo(b('leftLowerArm'), 0, -1.6 * g, -0.2 * g, k)
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

/** 飛行（ライダーキック）姿勢：右脚を前に突き出し、左脚を折り、腕は後ろへ */
export function applyFlyPose(vrm: VRM, dt: number) {
  const h = vrm.humanoid
  const k = Math.min(1, 14 * dt)
  const b = (n: VRMHumanBoneName) => h.getNormalizedBoneNode(n)
  const g = armSign(vrm)
  lerpTo(b('rightUpperLeg'), -1.4, 0, 0, k)
  lerpTo(b('rightLowerLeg'), 0.1, 0, 0, k)
  lerpTo(b('leftUpperLeg'), 0.6, 0, 0, k)
  lerpTo(b('leftLowerLeg'), 1.9, 0, 0, k)
  lerpTo(b('spine'), 0.1, 0, 0, k)
  lerpTo(b('leftUpperArm'), 0.9 * g, 0, -1.0 * g, k)
  lerpTo(b('rightUpperArm'), 0.9 * g, 0, 1.0 * g, k)
  lerpTo(b('leftLowerArm'), 0, -0.6 * g, -0.2 * g, k)
  lerpTo(b('rightLowerArm'), 0, 0.6 * g, 0.2 * g, k)
  const hips = b('hips')
  if (hips) {
    const base = (hips.userData.baseY ??= hips.position.y) as number
    hips.position.y = base
  }
}
