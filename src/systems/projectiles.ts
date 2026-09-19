import * as THREE from 'three'

/**
 * 敵の弾（爆弾・ミサイル・砲弾）の登録簿。バルカンで撃ち落とせるように、位置と当たり半径を共有する。
 * pos は持ち主の Vector3 をそのまま参照する（毎フレームのコピー不要）。撃ち落とされると dead=true になるので、持ち主はそれを見て消す
 */
export interface Projectile {
  pos: THREE.Vector3
  radius: number
  dead: boolean
}

export const projectiles: Projectile[] = []

export function addProjectile(pos: THREE.Vector3, radius: number): Projectile {
  const p = { pos, radius, dead: false }
  projectiles.push(p)
  return p
}

export function removeProjectile(p: Projectile | undefined) {
  if (!p) return
  const i = projectiles.indexOf(p)
  if (i >= 0) projectiles.splice(i, 1)
}
