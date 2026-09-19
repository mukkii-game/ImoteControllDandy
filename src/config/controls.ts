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
  /** 妹の技 */
  skill1: ['Digit1', 'Numpad1'],
  skill2: ['Digit2', 'Numpad2'],
  skill3: ['Digit3', 'Numpad3'],
  /** ホイールで選んだ技を発動（ホイールクリック） */
  skillFire: [],
  /** デバッグ：俯瞰カメラ切替 */
  debugCam: ['KeyP'],
} as const

export type Action = keyof typeof KEYS
