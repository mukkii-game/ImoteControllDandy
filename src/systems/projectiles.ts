import * as THREE from 'three'
import { refs } from './refs'
import { GAME } from '../config/game'

/**
 * 敵の弾（爆弾・ミサイル・砲弾）の登録簿。見た目は entities/Projectiles.tsx がここからまとめて描き、
 * バルカンは当たり判定にここを使う。pos / vel は持ち主の Vector3 をそのまま参照する（毎フレームのコピー不要）。
 * 撃ち落とされると dead=true になるので、持ち主はそれを見て消す
 */
export interface Projectile {
  pos: THREE.Vector3
  /** 進行方向（向きの表示用）。無ければ真下向き */
  vel?: THREE.Vector3
  /** 当たり判定の半径（m） */
  radius: number
  kind: 'missile' | 'bomb'
  dead: boolean
}

export const projectiles: Projectile[] = []

export function addProjectile(pos: THREE.Vector3, radius: number, kind: Projectile['kind'] = 'missile', vel?: THREE.Vector3): Projectile {
  const p: Projectile = { pos, vel, radius, kind, dead: false }
  projectiles.push(p)
  return p
}

export function removeProjectile(p: Projectile | undefined) {
  if (!p) return
  const i = projectiles.indexOf(p)
  if (i >= 0) projectiles.splice(i, 1)
}

/**
 * 弾が妹の体に当たったか。当たっていれば体の表面上の着弾点を out に入れて返す（爆発をそこに出す）。
 * 体は足元を中心とする半径 GAME.bodyRadius・高さ 8〜62m の円柱として扱う
 */
export function imoutoImpact(pos: THREE.Vector3, radius: number, out: THREE.Vector3): THREE.Vector3 | null {
  const im = refs.imouto
  if (!im) return null
  const dx = pos.x - im.position.x
  const dz = pos.z - im.position.z
  const d = Math.hypot(dx, dz)
  if (d > GAME.bodyRadius + radius) return null
  const y = pos.y - im.position.y
  if (y < 8 || y > 62) return null
  const r = GAME.bodyRadius
  if (d < 0.01) out.set(im.position.x, pos.y, im.position.z + r)
  else out.set(im.position.x + (dx / d) * r, pos.y, im.position.z + (dz / d) * r)
  return out
}
