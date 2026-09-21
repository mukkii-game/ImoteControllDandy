/**
 * スマホは横画面で遊ぶ。
 * - スタートを押した時（ユーザー操作の中でしか許されない）に全画面にして、画面の向きを横に固定する（Android Chrome）。
 *   iPhone の Safari は向きの固定に対応していないので、縦のままなら「横にしてね」の表示（CSS の .rotate-hint）で促す
 * - ホーム画面に追加（PWA）した時は manifest.webmanifest の orientation: landscape が効く
 */
export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
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
    /* iOS などは固定できない。CSS の「横にしてね」に任せる */
  }
}
