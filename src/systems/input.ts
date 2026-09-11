import { create } from 'zustand'
import { KEYS, type Action } from '../config/controls'

type Pressed = Record<Action, boolean>
const empty = (): Pressed => ({ up: false, down: false, left: false, right: false, a: false, b: false, debugCam: false })

interface InputState {
  keys: Pressed
  /** デバッグ俯瞰カメラ ON/OFF */
  overview: boolean
  /** 仮想スティック (-1..1) */
  stick: { x: number; y: number }
  set: (a: Action, v: boolean) => void
  setStick: (x: number, y: number) => void
  /** ボタンの「押した瞬間」を1回だけ消費する */
  consumeB: () => boolean
  consumeA: () => boolean
  _bEdge: boolean
  _aEdge: boolean
}

export const useInput = create<InputState>((set, get) => ({
  keys: empty(),
  overview: false,
  stick: { x: 0, y: 0 },
  _bEdge: false,
  _aEdge: false,
  set: (a, v) =>
    set((s) => {
      const bEdge = a === 'b' && v && !s.keys.b ? true : s._bEdge
      const aEdge = a === 'a' && v && !s.keys.a ? true : s._aEdge
      const overview = a === 'debugCam' && v && !s.keys.debugCam ? !s.overview : s.overview
      return { keys: { ...s.keys, [a]: v }, _bEdge: bEdge, _aEdge: aEdge, overview }
    }),
  setStick: (x, y) => set({ stick: { x, y } }),
  consumeB: () => {
    const e = get()._bEdge
    if (e) set({ _bEdge: false })
    return e
  },
  consumeA: () => {
    const e = get()._aEdge
    if (e) set({ _aEdge: false })
    return e
  },
}))

/** 現在の移動入力 (-1..1)。キーと仮想スティックを合成 */
export function readMove(): { x: number; y: number } {
  const { keys, stick } = useInput.getState()
  let x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + stick.x
  let y = (keys.up ? 1 : 0) - (keys.down ? 1 : 0) + stick.y
  const len = Math.hypot(x, y)
  if (len > 1) {
    x /= len
    y /= len
  }
  return { x, y }
}

const codeToAction = new Map<string, Action>()
for (const [action, codes] of Object.entries(KEYS)) {
  for (const c of codes) codeToAction.set(c, action as Action)
}

export function bindKeyboard(): () => void {
  const down = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return
    const a = codeToAction.get(e.code)
    if (a) {
      e.preventDefault()
      useInput.getState().set(a, true)
    }
  }
  const up = (e: KeyboardEvent) => {
    const a = codeToAction.get(e.code)
    if (a) useInput.getState().set(a, false)
  }
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
  }
}
