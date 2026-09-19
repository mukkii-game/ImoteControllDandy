import { create } from 'zustand'
import { QUALITY, STAGE, CAMERA, type QualityLevel } from '../config/game'
import { FIGHTERS, HELIS } from '../config/waves'

/**
 * 品質プリセット（低／中／高／自動）。config の数値をその場で書き換え、version を上げて必要な部品を作り直させる。
 * 選択は URL の ?q=low|mid|high|auto か localStorage（ユーザーが選んだ時だけ保存）。自動は開始後に fps を測って決める
 */
export type QualityChoice = QualityLevel | 'auto'

interface QualityState {
  /** ユーザーの選択（auto を含む） */
  choice: QualityChoice
  /** 実際に効いているプリセット */
  level: QualityLevel
  /** 自動判定が終わったか */
  autoDone: boolean
  version: number
  setChoice: (c: QualityChoice, persist?: boolean) => void
  applyLevel: (l: QualityLevel) => void
}

const KEY = 'icd.quality'

function readInitial(): QualityChoice {
  const q = new URLSearchParams(location.search).get('q')
  if (q === 'low' || q === 'mid' || q === 'high' || q === 'auto') return q
  if (location.search.includes('lite')) return 'low'
  try {
    const s = localStorage.getItem(KEY)
    if (s === 'low' || s === 'mid' || s === 'high' || s === 'auto') return s
  } catch {
    /* ignore */
  }
  // スマホ（タッチ操作）は何も選んでいなければ最初から「低」
  if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return QUALITY.touchDefault
  return QUALITY.default
}

/** プリセットの値を config に書き込む */
function apply(level: QualityLevel) {
  const p = QUALITY.presets[level]
  STAGE.drawDist = p.drawDist
  STAGE.lodDist = p.lodDist
  STAGE.shadowDist = p.shadowDist
  STAGE.fogNear = p.fogNear
  STAGE.fogFar = p.fogFar
  STAGE.kit.enabled = p.kit
  FIGHTERS.squadrons = p.fighterSquadrons
  HELIS.groups = p.heliGroups
  CAMERA.aim.xray.enabled = p.xray
}

export const useQuality = create<QualityState>((set, get) => ({
  choice: 'auto',
  level: 'high',
  autoDone: false,
  version: 0,
  setChoice: (choice, persist = true) => {
    if (persist) {
      try {
        localStorage.setItem(KEY, choice)
      } catch {
        /* ignore */
      }
    }
    set({ choice, autoDone: choice !== 'auto' })
    if (choice !== 'auto') get().applyLevel(choice)
    else get().applyLevel(QUALITY.autoStart)
  },
  applyLevel: (level) => {
    apply(level)
    set((s) => ({ level, version: s.version + 1 }))
  },
}))

// 起動時：選択を読んで適用
{
  const c = readInitial()
  useQuality.getState().setChoice(c, false)
}

/** 現在のプリセットの値 */
export function preset() {
  return QUALITY.presets[useQuality.getState().level]
}

/** 描画解像度の倍率：プリセットの倍率を、最大フルHD（QUALITY.maxWidth × maxHeight）で頭打ちにする */
export function effectiveDpr(): number {
  const p = preset()
  const dprCap = Math.min(QUALITY.maxWidth / window.innerWidth, QUALITY.maxHeight / window.innerHeight)
  return Math.max(0.5, Math.min(p.dpr, dprCap))
}
