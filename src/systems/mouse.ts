import { CAMERA } from '../config/game'
import { refs } from './refs'
import { useGame } from './store'
import * as THREE from 'three'

/**
 * マウス／タッチでカメラを回す。
 * PC：キャンバスをクリックでポインターロック、以降マウス移動で回転。Esc で解除。ドラッグでも可。
 * タッチ：画面右半分（仮想パッド以外）をドラッグ。
 */
export function bindMouse(el: HTMLElement): () => void {
  const apply = (dx: number, dy: number, sens: number) => {
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
    if ((e.target as HTMLElement).closest('.stick, .buttons, .tune')) return
    if (useGame.getState().tuneOpen) return
    dragging = true
    if (document.pointerLockElement !== el) el.requestPointerLock?.()
  }
  const onMouseUp = () => {
    dragging = false
  }
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
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  el.addEventListener('touchstart', onTouchStart, { passive: true })
  el.addEventListener('touchmove', onTouchMove, { passive: true })
  el.addEventListener('touchend', onTouchEnd)
  el.addEventListener('touchcancel', onTouchEnd)
  return () => {
    el.removeEventListener('mousedown', onMouseDown)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', onTouchEnd)
    el.removeEventListener('touchcancel', onTouchEnd)
  }
}
