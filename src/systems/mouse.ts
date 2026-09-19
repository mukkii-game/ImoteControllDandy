import { CAMERA, LOCKON } from '../config/game'
import { refs } from './refs'
import { useGame } from './store'
import { useInput } from './input'
import * as THREE from 'three'

/**
 * マウス／タッチでカメラを回す。
 * PC：キャンバスをクリックでポインターロック、以降マウス移動で回転。Esc で解除。ドラッグでも可。
 * 溜め中（サイト表示中）はカメラではなくサイト自体が画面内を動く（画面端でカメラが押される処理は lockon 側）。
 * タッチ：画面右半分（仮想パッド以外）をドラッグ。
 */
export function bindMouse(el: HTMLElement): () => void {
  const apply = (dx: number, dy: number, sens: number) => {
    if (dx !== 0 || dy !== 0) refs.lastLookInput = performance.now()
    const g = useGame.getState()
    if (g.charging) {
      const k = LOCKON.reticle.sensitivity
      refs.reticleX = THREE.MathUtils.clamp(refs.reticleX + dx * k, -window.innerWidth / 2, window.innerWidth / 2)
      refs.reticleY = THREE.MathUtils.clamp(refs.reticleY + dy * k, -window.innerHeight / 2, window.innerHeight / 2)
      return
    }
    if (g.mode === 'ground' && g.phase === 'play' && LOCKON.reticle.groundHorizontalOnly) {
      // 地上：サイトは左右にだけ動く（タックルの向き）。上下はカメラ
      refs.reticleX = THREE.MathUtils.clamp(refs.reticleX + dx * LOCKON.reticle.sensitivity, -window.innerWidth / 2, window.innerWidth / 2)
      refs.camPitch = THREE.MathUtils.clamp(refs.camPitch + dy * sens, CAMERA.pitchMin, CAMERA.pitchMax)
      return
    }
    refs.camYaw -= dx * sens
    refs.camPitch = THREE.MathUtils.clamp(refs.camPitch + dy * sens, CAMERA.pitchMin, CAMERA.pitchMax)
  }
  let dragging = false
  let lastX = 0
  let lastY = 0
  let touchId: number | null = null

  const onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement === el) apply(e.movementX, e.movementY, CAMERA.mouseSensitivity)
    else if (dragging) apply(e.movementX, e.movementY, CAMERA.mouseSensitivity)
  }
  const onMouseDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('.stick, .buttons, .tune, .overlay, .skillbar')) return
    if (useGame.getState().tuneOpen) return
    dragging = true
    if (document.pointerLockElement !== el) el.requestPointerLock?.()
    const inp = useInput.getState()
    // 左＝A（押している間サイトを動かしてロック→離して投擲）、右＝B（飛び乗る／飛び降りる）、中＝選択中の技
    if (e.button === 0) inp.set('a', true)
    if (e.button === 2) inp.set('b', true)
    if (e.button === 1) {
      e.preventDefault()
      inp.press('skillFire')
    }
  }
  const onMouseUp = (e: MouseEvent) => {
    dragging = false
    const inp = useInput.getState()
    if (e.button === 0) inp.set('a', false)
    if (e.button === 2) inp.set('b', false)
  }
  const onWheel = (e: WheelEvent) => {
    if (useGame.getState().tuneOpen) return
    e.preventDefault()
    const inp = useInput.getState()
    const n = (inp.skillSel + (e.deltaY > 0 ? 1 : -1) + 3) % 3
    inp.setSkillSel(n)
  }
  const onContext = (e: Event) => e.preventDefault()
  const onTouchStart = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      const target = document.elementFromPoint(t.clientX, t.clientY)
      if (target?.closest('.stick, .buttons, .tune')) continue
      if (touchId === null) {
        touchId = t.identifier
        lastX = t.clientX
        lastY = t.clientY
      }
    }
  }
  const onTouchMove = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== touchId) continue
      apply(t.clientX - lastX, t.clientY - lastY, CAMERA.touchSensitivity)
      lastX = t.clientX
      lastY = t.clientY
    }
  }
  const onTouchEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) if (t.identifier === touchId) touchId = null
  }

  el.addEventListener('mousedown', onMouseDown)
  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('contextmenu', onContext)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  el.addEventListener('touchstart', onTouchStart, { passive: true })
  el.addEventListener('touchmove', onTouchMove, { passive: true })
  el.addEventListener('touchend', onTouchEnd)
  el.addEventListener('touchcancel', onTouchEnd)
  return () => {
    el.removeEventListener('mousedown', onMouseDown)
    el.removeEventListener('wheel', onWheel)
    el.removeEventListener('contextmenu', onContext)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', onTouchEnd)
    el.removeEventListener('touchcancel', onTouchEnd)
  }
}
