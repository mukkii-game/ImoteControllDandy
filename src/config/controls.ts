// キー/ボタン割当。ここを変えれば入力の意味が変わる。
export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  /** ボタンA：攻撃 / 長押しで超ジャンプ */
  a: ['Space'],
  /** ボタンB：乗る / 降りる */
  b: ['ShiftLeft', 'ShiftRight', 'KeyE'],
} as const

export type Action = keyof typeof KEYS
