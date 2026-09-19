import * as THREE from 'three'

/** エンティティ間で共有する参照（カメラ・乗降で使う）。React state にしないのは毎フレーム更新のため */
export const refs = {
  bro: null as THREE.Group | null,
  imouto: null as THREE.Group | null,
  /** 妹の肩アンカー（ボーンの子）。getWorldPosition で使う */
  shoulder: null as THREE.Object3D | null,
  /** 妹の頭ボーン。肩上カメラのオービット中心 */
  head: null as THREE.Object3D | null,
  /** 兄の向き（yaw, rad） */
  broYaw: 0,
  /** カメラのオービット角（マウス操作）。yaw は「カメラが向いている方向」 */
  camYaw: Math.PI,
  camPitch: 0.12,
  /** 直近のカメラ位置（投擲カメラの側判定用） */
  camPos: new THREE.Vector3(),
  /** 最後にカメラ入力があった時刻（ms）。地上の「妹が気になる」引き戻しに使う */
  lastLookInput: 0,
  /** サイトの画面中心からのずれ（px）。溜め中はマウスでこれが動く */
  reticleX: 0,
  reticleY: 0,
  /** 兄の頭の画面座標 [x, y, 画面内か]（吹き出し用。lockon が毎フレーム更新） */
  broScreen: [0, 0, false] as [number, number, boolean],
  /** 兄の乗降アニメ用の始点（ワールド） */
  mountStart: new THREE.Vector3(),
  mountDuration: 1,
}

const tmp = new THREE.Vector3()
export function shoulderWorld(out = tmp): THREE.Vector3 {
  if (!refs.shoulder) return out.set(0, 0, 0)
  return refs.shoulder.getWorldPosition(out)
}

// デバッグ用：コンソールから位置を確認できる
;(window as unknown as { __refs: typeof refs }).__refs = refs
