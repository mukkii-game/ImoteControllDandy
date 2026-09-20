import { create } from 'zustand'
import { BGM_CHOICES, type BgmChoice } from '../config/game'

/** ゲーム中 BGM の選択（Esc パネル）。localStorage に保存。曲の切替は audio.ts が購読して行う */
const KEY = 'imouto-bgm-v1'

function load(): BgmChoice {
  try {
    const s = localStorage.getItem(KEY)
    if (s && BGM_CHOICES.some((c) => c.id === s)) return s as BgmChoice
  } catch {
    /* ignore */
  }
  return BGM_CHOICES[0].id
}

interface BgmState {
  choice: BgmChoice
  setChoice: (c: BgmChoice) => void
}

export const useBgm = create<BgmState>((set) => ({
  choice: load(),
  setChoice: (choice) => {
    try {
      localStorage.setItem(KEY, choice)
    } catch {
      /* ignore */
    }
    set({ choice })
  },
}))

/** 今選ばれている BGM の voices.json キー */
export function bgmKey(): string {
  const id = useBgm.getState().choice
  return (BGM_CHOICES.find((c) => c.id === id) ?? BGM_CHOICES[0]).key
}
