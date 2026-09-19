import { create } from 'zustand'

export type RideMode = 'ground' | 'mounting' | 'shoulder' | 'dismounting' | 'thrown'

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
  /** 溜め中（サイト表示） */
  charging: boolean
  setCharging: (v: boolean) => void
  score: number
  addScore: (n: number) => void
  /** 直近のコンボ表示 */
  combo: { n: number; at: number } | null
  setCombo: (n: number) => void
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
  charging: false,
  setCharging: (charging) => set({ charging }),
  score: 0,
  addScore: (n) => set((s) => ({ score: s.score + n })),
  combo: null,
  setCombo: (n) => set({ combo: { n, at: performance.now() } }),
}))
