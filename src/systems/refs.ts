import * as THREE from 'three'

/** エンティティ間で共有する参照（カメラ・乗降で使う）。React state にしないのは毎フレーム更新のため */
export const refs = {
  bro: null as THREE.Group | null,
  imouto: null as THREE.Group | null,
  /** 妹の肩（ワールド座標に変換して使う）。妹 group の子 */
  shoulder: null as THREE.Object3D | null,
  /** 兄の向いている方向（yaw, rad） */
  broYaw: 0,
}

const tmp = new THREE.Vector3()
export function shoulderWorld(out = tmp): THREE.Vector3 {
  if (!refs.shoulder) return out.set(0, 0, 0)
  return refs.shoulder.getWorldPosition(out)
}
