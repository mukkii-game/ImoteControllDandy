/** 演出用の軽量イベント。エンティティが発火し、systems（カメラ・音）が受ける */
type Handler<T> = (payload: T) => void

export interface GameEvents {
  /** 妹が一歩踏んだ。strength: 0..1 */
  'imouto.step': { strength: number; x: number; z: number }
  'bro.mount': void
  'bro.dismount': void
  'bro.jump': void
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
