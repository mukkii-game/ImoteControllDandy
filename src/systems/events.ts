/** 演出用の軽量イベント。エンティティが発火し、systems（カメラ・音）が受ける */
type Handler<T> = (payload: T) => void

export interface GameEvents {
  /** 妹が一歩踏んだ。strength: 0..1 */
  'imouto.step': { strength: number; x: number; z: number }
  'bro.mount': void
  'bro.dismount': void
  'bro.jump': void
  /** ロックオン攻撃開始。from: 肩上（妹が掴んで投げる）か地上（兄が自力で跳ぶ）か */
  'bro.throw': { count: number; from: 'shoulder' | 'ground' }
  /** 兄が敵に着弾 */
  'enemy.hit': { id: number; x: number; y: number; z: number }
  'bro.return': void
  /** 兄のセリフ（吹き出し） */
  'bro.say': { text: string }
  /** 兄が妹に行き先を指示した */
  'bro.goto': { x: number; z: number }
  /** 妹が被弾（ミサイル・砲弾） */
  'imouto.hit': { x: number; y: number; z: number }
  /** 妹の技 */
  'imouto.skill': { id: 'skip' | 'shoe' | 'cry' }
  /** 靴が飛ぶ（靴飛ばし） */
  'shoe.launch': { x: number; y: number; z: number; yaw: number }
  'game.clear': void
  'game.late': void
  /** 建物が砕ける（ブロック破片を出す） */
  'building.break': { x: number; z: number; w: number; h: number; d: number; color: string }
  /** 低い家が踏み潰される（屋根が飛び、壁の破片が散る） */
  'building.crush': { x: number; z: number; w: number; h: number; d: number; color: string; roofColor?: string }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlers = new Map<keyof GameEvents, Set<Handler<any>>>()

export function on<K extends keyof GameEvents>(name: K, h: Handler<GameEvents[K]>): () => void {
  let set = handlers.get(name)
  if (!set) {
    set = new Set()
    handlers.set(name, set)
  }
  set.add(h)
  return () => set.delete(h)
}

export function emit<K extends keyof GameEvents>(name: K, payload: GameEvents[K]) {
  handlers.get(name)?.forEach((h) => h(payload))
}
