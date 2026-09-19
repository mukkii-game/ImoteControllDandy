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
export function applyFace(vrm: VRM, t: number, walkRatio: number, f: { happy: number; mouthOpen: number; mouthOpenWalk: number; blinkPeriod: number }, hit = false) {
  const em = vrm.expressionManager
  if (!em) return
  if (hit) {
    // 被弾：おどろき（VRM1: surprised / VRM0: Surprised）
    em.setValue('happy', 0)
    em.setValue('aa', 0.6)
    em.setValue('surprised', 1)
    em.setValue('Surprised', 1)
    em.setValue('blink', 0)
    return
  }
  em.setValue('surprised', 0)
  em.setValue('Surprised', 0)
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

/**
 * 技ポーズ（歩行の上から上書き）。t は技開始からの秒数。
 * skip: 大きく跳ねる（腕を上げて振る）、shoe: 右脚を蹴り上げる、cry: 両手で顔を覆う
 */
export function applySkillPose(vrm: VRM, id: 'skip' | 'shoe' | 'cry', t: number, modelHeight: number) {
  const h = vrm.humanoid
  const b = (n: VRMHumanBoneName) => h.getNormalizedBoneNode(n)
  const g = armSign(vrm)
  const hips = b('hips')
  const base = hips ? ((hips.userData.baseY ??= hips.position.y) as number) : 0
  if (id === 'skip') {
    const ph = t * Math.PI * 2 * 1.8
    const s = Math.sin(ph)
    // 大跳ね
    if (hips) hips.position.y = base + Math.max(0, s) * 0.09 * modelHeight
    b('leftUpperLeg')?.rotation.set(s * 1.1, 0, 0)
    b('rightUpperLeg')?.rotation.set(-s * 1.1, 0, 0)
    b('leftLowerLeg')?.rotation.set(Math.max(0, -s) * 1.6, 0, 0)
    b('rightLowerLeg')?.rotation.set(Math.max(0, s) * 1.6, 0, 0)
    // 腕を大きく振る（前後＋やや外）
    b('leftUpperArm')?.rotation.set(-s * 1.6 * g, 0, -0.6 * g)
    b('rightUpperArm')?.rotation.set(s * 1.6 * g, 0, 0.6 * g)
    b('leftLowerArm')?.rotation.set(0, 0, -0.1 * g)
    b('rightLowerArm')?.rotation.set(0, 0, 0.1 * g)
    b('spine')?.rotation.set(-0.15 + s * 0.1, 0, 0)
    return
  }
  if (id === 'shoe') {
    const k = Math.min(1, t / 0.35)
    const kick = Math.sin(k * Math.PI * 0.5)
    if (hips) hips.position.y = base
    b('rightUpperLeg')?.rotation.set(-2.0 * kick, 0, 0)
    b('rightLowerLeg')?.rotation.set(0.2 * (1 - kick), 0, 0)
    b('leftUpperLeg')?.rotation.set(0.15 * kick, 0, 0)
    b('leftLowerLeg')?.rotation.set(0, 0, 0)
    b('spine')?.rotation.set(0.35 * kick, 0, 0)
    // 腕でバランス（後ろへ）
    b('leftUpperArm')?.rotation.set(0.9 * kick * g, 0, -1.2 * g)
    b('rightUpperArm')?.rotation.set(0.9 * kick * g, 0, 1.2 * g)
    return
  }
  // cry
  const k = Math.min(1, t / 0.3)
  if (hips) hips.position.y = base - 0.01 * modelHeight * k
  b('leftUpperLeg')?.rotation.set(0, 0, 0)
  b('rightUpperLeg')?.rotation.set(0, 0, 0)
  b('leftLowerLeg')?.rotation.set(0, 0, 0)
  b('rightLowerLeg')?.rotation.set(0, 0, 0)
  b('spine')?.rotation.set(0.25 * k, 0, 0)
  b('head')?.rotation.set(0.35 * k, 0, 0)
  // 両手を顔へ：上腕を下ろしてから前へ振り上げ（X 回転）、前腕を顔側へ折る（Y 回転）
  b('leftUpperArm')?.rotation.set(-1.6 * k * g, 0.6 * k, -1.0 * g)
  b('rightUpperArm')?.rotation.set(-1.6 * k * g, -0.6 * k, 1.0 * g)
  b('leftLowerArm')?.rotation.set(0, -2.6 * k * g, 0)
  b('rightLowerArm')?.rotation.set(0, 2.6 * k * g, 0)
}

/** 投げる腕：左腕（兄が乗っている側）を後ろから前へ振る。k: 0..1 */
export function applyThrowArm(vrm: VRM, k: number) {
  const g = armSign(vrm)
  const up = vrm.humanoid.getNormalizedBoneNode('leftUpperArm')
  const lo = vrm.humanoid.getNormalizedBoneNode('leftLowerArm')
  const swing = Math.sin(k * Math.PI) // 0→1→0
  up?.rotation.set(-2.6 * swing * g, 0, -0.9 * g)
  lo?.rotation.set(0, -0.9 * (1 - k) * g, -0.2 * g)
}

/** 技ごとの表情。t は技開始からの秒数 */
export function applySkillFace(vrm: VRM, id: 'skip' | 'shoe' | 'cry', t: number) {
  const em = vrm.expressionManager
  if (!em) return
  const set = (n: string, v: number) => em.setValue(n, v)
  set('surprised', 0)
  set('Surprised', 0)
  if (id === 'cry') {
    set('happy', 0)
    set('sad', 1)
    set('aa', 0.55 + Math.sin(t * 9) * 0.15)
    set('blink', 1)
    return
  }
  set('sad', 0)
  set('happy', 1)
  set('aa', id === 'skip' ? 0.7 : 0.3)
  set('blink', 0)
}

/** 体育座り（ED）。k: 0..1 で座り込む */
export function applySitPose(vrm: VRM, k: number, modelHeight: number) {
  const h = vrm.humanoid
  const b = (n: VRMHumanBoneName) => h.getNormalizedBoneNode(n)
  const g = armSign(vrm)
  const hips = b('hips')
  if (hips) {
    const base = (hips.userData.baseY ??= hips.position.y) as number
    hips.position.y = base - 0.42 * modelHeight * k
  }
  b('leftUpperLeg')?.rotation.set(-2.2 * k, 0, 0.12 * k)
  b('rightUpperLeg')?.rotation.set(-2.2 * k, 0, -0.12 * k)
  b('leftLowerLeg')?.rotation.set(2.5 * k, 0, 0)
  b('rightLowerLeg')?.rotation.set(2.5 * k, 0, 0)
  b('spine')?.rotation.set(0.25 * k, 0, 0)
  b('head')?.rotation.set(-0.1 * k, 0, 0)
  // 膝を抱える
  b('leftUpperArm')?.rotation.set(-1.2 * k * g, 0, -0.9 * g)
  b('rightUpperArm')?.rotation.set(-1.2 * k * g, 0, 0.9 * g)
  b('leftLowerArm')?.rotation.set(0, -1.6 * k * g, -0.3 * g)
  b('rightLowerArm')?.rotation.set(0, 1.6 * k * g, 0.3 * g)
}
