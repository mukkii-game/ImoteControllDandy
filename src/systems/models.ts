import { create } from 'zustand'
import { MODEL_CHOICES, type ModelChoice } from '../config/game'

const KEY = 'imouto-models-v1'

interface ModelState {
  imouto: string
  bro: string
  /** 実際に読み込めたモデル（フォールバック後） */
  resolved: { imouto?: ModelChoice; bro?: ModelChoice }
  select: (who: 'imouto' | 'bro', id: string) => void
  setResolved: (who: 'imouto' | 'bro', c: ModelChoice) => void
}

function load(): { imouto: string; bro: string } {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...{ imouto: MODEL_CHOICES.imouto[0].id, bro: MODEL_CHOICES.bro[0].id }, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { imouto: MODEL_CHOICES.imouto[0].id, bro: MODEL_CHOICES.bro[0].id }
}

export const useModels = create<ModelState>((set, get) => ({
  ...load(),
  resolved: {},
  select: (who, id) => {
    set({ [who]: id } as Partial<ModelState>)
    try {
      localStorage.setItem(KEY, JSON.stringify({ imouto: get().imouto, bro: get().bro }))
    } catch {
      /* ignore */
    }
  },
  setResolved: (who, c) => set((s) => ({ resolved: { ...s.resolved, [who]: c } })),
}))

/** 選択中を先頭に、他を後ろに並べた候補リスト（ファイルが無い時のフォールバック用） */
export function candidates(who: 'imouto' | 'bro', id: string): ModelChoice[] {
  const list = MODEL_CHOICES[who]
  const sel = list.find((c) => c.id === id) ?? list[0]
  return [sel, ...list.filter((c) => c !== sel)]
}
