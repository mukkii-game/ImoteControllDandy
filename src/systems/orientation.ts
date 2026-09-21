/**
 * スマホは横画面で遊ぶ。
 * 1) スタートを押した時（ユーザー操作の中でしか許されない）に全画面にして、画面の向きを横に固定する（Android Chrome）
 * 2) それでも縦のまま（iPhone の Safari、自動回転オフ、固定に失敗）なら、アプリ全体を CSS で 90° 回して横画面にする（html.rotated）。
 *    その間はタッチの座標系が画面と 90° ずれるので、指の動きは screenToApp で直す。画面の大きさは appSize() を使う（window.innerWidth ではなく）
 * 3) ホーム画面に追加（PWA）した時は manifest.webmanifest の orientation: landscape が効く
 */
export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

/** アプリから見た画面の大きさ（回している間は縦横が入れ替わる） */
export const view = { rotated: false, w: 1, h: 1 }

export function appSize() {
  return view
}

export function updateView() {
  const w = window.innerWidth
  const h = window.innerHeight
  const rotated = isTouchDevice() && w < h
  view.rotated = rotated
  view.w = rotated ? h : w
  view.h = rotated ? w : h
  document.documentElement.classList.toggle('rotated', rotated)
}

/** 画面上の指の動き（dx, dy）をアプリの座標に直す。回している時は「画面の下＝アプリの右、画面の右＝アプリの上」 */
export function screenToApp(dx: number, dy: number): [number, number] {
  return view.rotated ? [dy, -dx] : [dx, dy]
}

/** 画面の向きの監視を始める（App で一度）。戻り値で解除 */
export function bindOrientation(): () => void {
  updateView()
  const on = () => updateView()
  window.addEventListener('resize', on)
  window.addEventListener('orientationchange', on)
  return () => {
    window.removeEventListener('resize', on)
    window.removeEventListener('orientationchange', on)
  }
}

export async function requestLandscape(): Promise<void> {
  if (!isTouchDevice()) return
  try {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' })
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
    }
  } catch {
    /* 全画面にできなくても続ける */
  }
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (t: string) => Promise<void> }
    if (o?.lock) await o.lock('landscape')
  } catch {
    /* iOS などは固定できない。CSS で回す（updateView） */
  }
  setTimeout(updateView, 300)
}
