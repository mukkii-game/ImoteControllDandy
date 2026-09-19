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
  /** 今のロックオン攻撃がどこから始まったか（カメラの扱いが変わる） */
  attackFrom: 'shoulder' | 'ground'
  setAttackFrom: (v: 'shoulder' | 'ground') => void
  /** 兄が指示した行き先。妹はここへ向かって旋回する（A D で上書き） */
  waypoint: { x: number; z: number } | null
  setWaypoint: (w: { x: number; z: number } | null) => void
  /** 兄の吹き出し */
  speech: { text: string; at: number } | null
  say: (text: string) => void
  /** 妹の吹き出し */
  imoutoSpeech: { text: string; at: number } | null
  sayImouto: (text: string) => void
  score: number
  addScore: (n: number) => void
  /** 直近のコンボ表示 */
  combo: { n: number; at: number } | null
  setCombo: (n: number) => void
  /** 技のクールダウン残り（秒）。HUD 表示用に低頻度で更新 */
  cooldowns: Record<string, number>
  setCooldowns: (c: Record<string, number>) => void
  activeSkill: string | null
  setActiveSkill: (s: string | null) => void
  phase: 'title' | 'play' | 'clear' | 'late'
  setPhase: (p: 'title' | 'play' | 'clear' | 'late') => void
  /** 残り秒（HUD 用に 0.1s 刻みで更新） */
  timeLeft: number
  setTimeLeft: (t: number) => void
  clearTime: number
  setClearTime: (t: number) => void
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
  attackFrom: 'shoulder',
  setAttackFrom: (attackFrom) => set({ attackFrom }),
  waypoint: null,
  setWaypoint: (waypoint) => set({ waypoint }),
  speech: null,
  say: (text) => set({ speech: { text, at: performance.now() } }),
  imoutoSpeech: null,
  sayImouto: (text) => set({ imoutoSpeech: { text, at: performance.now() } }),
  score: 0,
  addScore: (n) => set((s) => ({ score: s.score + n })),
  combo: null,
  setCombo: (n) => set({ combo: { n, at: performance.now() } }),
  cooldowns: {},
  setCooldowns: (cooldowns) => set({ cooldowns }),
  activeSkill: null,
  setActiveSkill: (activeSkill) => set({ activeSkill }),
  phase: 'title',
  setPhase: (phase) => set(phase === 'play' ? { phase, score: 0 } : { phase }),
  timeLeft: 0,
  setTimeLeft: (timeLeft) => set({ timeLeft }),
  clearTime: 0,
  setClearTime: (clearTime) => set({ clearTime }),
}))

// デバッグ用：コンソール／Playwright から状態を見る
;(window as unknown as { __game: typeof useGame }).__game = useGame
