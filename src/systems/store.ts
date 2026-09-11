import { create } from 'zustand'

export type RideMode = 'ground' | 'mounting' | 'shoulder' | 'dismounting'

interface GameState {
  mode: RideMode
  /** 乗降アニメの進捗 0..1 */
  transition: number
  loaded: { imouto: boolean; bro: boolean }
  setMode: (m: RideMode) => void
  setTransition: (t: number) => void
  setLoaded: (k: 'imouto' | 'bro') => void
  tuneOpen: boolean
  setTuneOpen: (v: boolean) => void
  /** 調整値が変わった回数。身長など再レンダーが必要な値の購読用 */
  tuneVersion: number
  bumpTune: () => void
}

export const useGame = create<GameState>((set) => ({
  mode: 'ground',
  transition: 0,
  loaded: { imouto: false, bro: false },
  setMode: (mode) => set({ mode }),
  setTransition: (transition) => set({ transition }),
  setLoaded: (k) => set((s) => ({ loaded: { ...s.loaded, [k]: true } })),
  tuneOpen: false,
  setTuneOpen: (tuneOpen) => set({ tuneOpen }),
  tuneVersion: 0,
  bumpTune: () => set((s) => ({ tuneVersion: s.tuneVersion + 1 })),
}))
