import { create } from 'zustand'

export type RideMode = 'ground' | 'mounting' | 'shoulder' | 'dismounting'

interface GameState {
  mode: RideMode
  /** 乗降アニメの進捗 0..1 */
  transition: number
  /** 兄が妹の足元にいて乗れる状態か */
  canMount: boolean
  setMode: (m: RideMode) => void
  setTransition: (t: number) => void
  setCanMount: (v: boolean) => void
}

export const useGame = create<GameState>((set) => ({
  mode: 'ground',
  transition: 0,
  canMount: false,
  setMode: (mode) => set({ mode }),
  setTransition: (transition) => set({ transition }),
  setCanMount: (canMount) => set({ canMount }),
}))
