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
}

export const useGame = create<GameState>((set) => ({
  mode: 'ground',
  transition: 0,
  loaded: { imouto: false, bro: false },
  setMode: (mode) => set({ mode }),
  setTransition: (transition) => set({ transition }),
  setLoaded: (k) => set((s) => ({ loaded: { ...s.loaded, [k]: true } })),
}))
