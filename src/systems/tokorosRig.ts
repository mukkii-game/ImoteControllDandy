import * as THREE from 'three'
import { TOKOROS } from '../config/game'

/**
 * トコロスの平泳ぎ（手続きアニメ）。モデルは Mixamo の骨（mixamorig:*）入りだがアニメは無いので、
 * 1 かきの位相 0..1 に対して腕・肘・脚・膝の角度をキーフレーム（TOKOROS.pose）で決めて骨に入れる。
 * 角度は「モデル（アーマチュア）の座標系の軸まわり」で与える：Y 上・Z 前（顔）・X 左腕側。
 * 骨のローカル軸は骨ごとにばらばらなので、親のワールド回転を使って「モデル座標の回転」をローカルに直している
 */
const NAMES = {
  lArm: 'mixamorig:LeftArm',
  rArm: 'mixamorig:RightArm',
  lFore: 'mixamorig:LeftForeArm',
  rFore: 'mixamorig:RightForeArm',
  lUpLeg: 'mixamorig:LeftUpLeg',
  rUpLeg: 'mixamorig:RightUpLeg',
  lLeg: 'mixamorig:LeftLeg',
  rLeg: 'mixamorig:RightLeg',
  spine: 'mixamorig:Spine',
  head: 'mixamorig:Head',
} as const
type BoneKey = keyof typeof NAMES

const qG = new THREE.Quaternion()
const qGi = new THREE.Quaternion()
const qP = new THREE.Quaternion()
const qPi = new THREE.Quaternion()
const qR = new THREE.Quaternion()
const qT = new THREE.Quaternion()
const AX = new THREE.Vector3(1, 0, 0)
const AY = new THREE.Vector3(0, 1, 0)
const AZ = new THREE.Vector3(0, 0, 1)

/** キーフレーム [位相, 値] を位相 0..1 で補間（間はなめらか）。最後→最初へも回る */
export function keyAt(keys: [number, number][], ph: number): number {
  const p = ((ph % 1) + 1) % 1
  for (let i = 0; i < keys.length; i++) {
    const a = keys[i]
    const b = keys[(i + 1) % keys.length]
    const bp = i + 1 < keys.length ? b[0] : b[0] + 1
    if (p >= a[0] && p < bp) {
      const k = bp === a[0] ? 0 : (p - a[0]) / (bp - a[0])
      const s = k * k * (3 - 2 * k)
      return a[1] + (b[1] - a[1]) * s
    }
  }
  return keys[0][1]
}

export class TokorosRig {
  private bones = new Map<BoneKey, THREE.Object3D>()
  private base = new Map<BoneKey, THREE.Quaternion>()
  private root: THREE.Object3D
  readonly ok: boolean

  constructor(scene: THREE.Object3D) {
    this.root = scene
    for (const [k, name] of Object.entries(NAMES) as [BoneKey, string][]) {
      // GLTFLoader は名前の ':' を落とす（mixamorig:LeftArm → mixamorigLeftArm）ので両方で探す
      const b = scene.getObjectByName(name) ?? scene.getObjectByName(name.replace(/[^\w-]/g, ''))
      if (b) {
        this.bones.set(k, b)
        this.base.set(k, b.quaternion.clone())
      }
    }
    this.ok = this.bones.has('lArm') && this.bones.has('rArm')
  }

  /** 骨を「モデル座標の軸 axis まわりに angle」回す（元のポーズからの相対）。親から順に呼ぶこと */
  private rot(key: BoneKey, rots: [THREE.Vector3, number][]) {
    const b = this.bones.get(key)
    const base = this.base.get(key)
    if (!b || !base || !b.parent) return
    // モデル座標での回転をワールドへ：Rw = G R G^-1
    this.root.getWorldQuaternion(qG)
    qGi.copy(qG).invert()
    qR.identity()
    for (const [axis, ang] of rots) {
      qT.setFromAxisAngle(axis, ang)
      qR.multiply(qT)
    }
    qR.premultiply(qG).multiply(qGi)
    // 親のワールド回転（親は先に更新済み）
    b.parent.updateWorldMatrix(true, false)
    b.parent.getWorldQuaternion(qP)
    qPi.copy(qP).invert()
    // Bl' = P^-1 · Rw · P · base
    b.quaternion.copy(base).premultiply(qP).premultiply(qR).premultiply(qPi)
  }

  /** 位相 ph（0..1、1 かき）のポーズを骨に入れる */
  pose(ph: number) {
    const P = TOKOROS.pose
    const elev = keyAt(P.armElev, ph) // 腕の上げ下げ（+ で頭の方へ＝前へ伸ばす）
    const sweep = keyAt(P.armSweep, ph) // 腕を体の前へ（胸の前に集める）
    const elbow = keyAt(P.elbow, ph) // 肘の曲げ
    const hip = keyAt(P.hip, ph) // 股関節の曲げ（膝を引き寄せる）
    const knee = keyAt(P.knee, ph) // 膝の曲げ（かかとをお尻へ）
    const legOut = keyAt(P.legOut, ph) // 脚を横に開く
    const spine = keyAt(P.spine, ph)
    this.rot('spine', [[AX, spine]])
    this.rot('head', [[AX, -spine * 1.5]])
    // 左腕は +X 側：上げる＝Z まわり +、前へ＝Y まわり −。右腕は符号が逆
    this.rot('lArm', [
      [AZ, elev],
      [AY, -sweep],
    ])
    this.rot('rArm', [
      [AZ, -elev],
      [AY, sweep],
    ])
    // 肘：前腕を体の前（+Z）へ曲げる＝左は Y まわり −、右は +（腕が横向きの時の軸。上げた時もおおむね内側へ曲がる）
    this.rot('lFore', [[AY, -elbow]])
    this.rot('rFore', [[AY, elbow]])
    // 脚：股関節は X まわり −（膝を前へ）、開きは Z まわり（左は −、右は +）、膝は X まわり +（かかとを後ろへ）
    this.rot('lUpLeg', [
      [AX, -hip],
      [AZ, -legOut],
    ])
    this.rot('rUpLeg', [
      [AX, -hip],
      [AZ, legOut],
    ])
    this.rot('lLeg', [[AX, knee]])
    this.rot('rLeg', [[AX, knee]])
  }
}
