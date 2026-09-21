import * as THREE from 'three'

export interface Enemy {
  id: number
  kind: 'dummy' | 'fighter' | 'police' | 'tank' | 'boss' | 'heli' | 'ally'
  pos: THREE.Vector3
  alive: boolean
  /** 破壊後の再出現までの残り秒（テスト用） */
  respawn: number
}

/** 敵のレジストリ。React state にしない（毎フレーム更新）。描画側は各エンティティが担当 */
export const enemies: Enemy[] = []
/** 敵 id → 見た目の Object3D（輪郭ハイライト用。各エンティティが毎フレーム登録。無い敵は箱で代用） */
export const enemyObjects = new Map<number, THREE.Object3D>()
/** 味方（トコロスなど）：敵ではないので電撃・ロック・タックルの対象にならないが、兄が乗れる。enemies とは別の登録簿 */
export const allies: Enemy[] = []
export function addAlly(pos: THREE.Vector3): Enemy {
  const e: Enemy = { id: nextId++, kind: 'ally', pos: pos.clone(), alive: true, respawn: 0 }
  allies.push(e)
  return e
}
/** 乗れる相手を id で探す（敵と味方の両方から） */
export function findRideable(id: number): Enemy | undefined {
  return enemies.find((e) => e.id === id && e.alive) ?? allies.find((e) => e.id === id && e.alive)
}
let nextId = 1

export function addEnemy(kind: Enemy['kind'], pos: THREE.Vector3): Enemy {
  const e: Enemy = { id: nextId++, kind, pos: pos.clone(), alive: true, respawn: 0 }
  enemies.push(e)
  return e
}

export function getEnemy(id: number): Enemy | undefined {
  return enemies.find((e) => e.id === id)
}

export function killEnemy(id: number, respawnSec = 0) {
  const e = getEnemy(id)
  if (!e) return
  e.alive = false
  e.respawn = respawnSec
}

/** ロックオン状態（毎フレーム更新するので ref 的に扱う） */
export const lock = {
  /** ロック済み敵 id（順序＝着弾順） */
  ids: [] as number[],
  /** 画面上の敵位置キャッシュ（HUD 用）。id → [x, y, inFront] */
  screen: new Map<number, [number, number, boolean]>(),
  /** 行き先（▼）をロックしたか。離すと妹に「あそこへ行け」 */
  dest: false,
  /** 行き先の画面座標 [x, y, inFront] */
  destScreen: [0, 0, false] as [number, number, boolean],
}

export function clearLocks() {
  lock.ids.length = 0
  lock.dest = false
}

/** 全敵スタン（泣く）。残り秒数 */
export const stun = { until: 0 }
export function stunAll(sec: number) {
  stun.until = performance.now() + sec * 1000
}
export function isStunned(): boolean {
  return performance.now() < stun.until
}
