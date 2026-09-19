/** 演出用の軽量イベント。エンティティが発火し、systems（カメラ・音）が受ける */
type Handler<T> = (payload: T) => void

export interface GameEvents {
  /** 妹が一歩踏んだ。strength: 0..1 */
  'imouto.step': { strength: number; x: number; z: number }
  'bro.mount': void
  'bro.dismount': void
  'bro.jump': void
  /** 投擲開始（妹が掴んで投げる） */
  'bro.throw': { count: number }
  /** 兄が敵に着弾 */
  'enemy.hit': { id: number; x: number; y: number; z: number }
  'bro.return': void
  /** 妹が被弾（ミサイル・砲弾） */
  'imouto.hit': { x: number; y: number; z: number }
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
