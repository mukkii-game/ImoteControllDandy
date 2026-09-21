import { CAMERA, LOCKON } from '../config/game'
import { refs } from './refs'
import { useGame } from './store'
import { useInput } from './input'
import { appSize, screenToApp } from './orientation'
import * as THREE from 'three'

/**
 * マウス／タッチでカメラを回す。
 * PC：キャンバスをクリックでポインターロック、以降マウス移動で回転。Esc で解除。ドラッグでも可。
 * 溜め中（サイト表示中）はカメラではなくサイト自体が画面内を動く（画面端でカメラが押される処理は lockon 側）。
 * タッチ：画面右半分（仮想パッド以外）をドラッグ。
 */
/**
 * 視点入力を反映する。dx/dy は「マウスが動いた px」、rdx/rdy は「サイトを動かす px」。
 * マウスは両方同じ値（reticle.sensitivity 倍）、タッチのスティックは速さ×dt で別々に渡す
 */
function applyLook(dx: number, dy: number, sens: number, rdx = dx * LOCKON.reticle.sensitivity, rdy = dy * LOCKON.reticle.sensitivity) {
  if (dx !== 0 || dy !== 0) refs.lastLookInput = performance.now()
  const g = useGame.getState()
  // 溜め中と肩上（最初から）：サイト自体が画面内を動く（画面端でカメラが押される処理は lockon 側）
  if (g.charging || (g.mode === 'shoulder' && g.phase === 'play')) {
    refs.reticleX = THREE.MathUtils.clamp(refs.reticleX + rdx, -appSize().w / 2, appSize().w / 2)
    refs.reticleY = THREE.MathUtils.clamp(refs.reticleY + rdy, -appSize().h / 2, appSize().h / 2)
    return
  }
  if (g.mode === 'ground' && g.phase === 'play' && LOCKON.reticle.groundHorizontalOnly) {
    // 地上：サイトは左右にだけ動く（タックルの向き）。上下はカメラ
    refs.reticleX = THREE.MathUtils.clamp(refs.reticleX + rdx, -appSize().w / 2, appSize().w / 2)
    refs.camPitch = THREE.MathUtils.clamp(refs.camPitch + dy * sens, CAMERA.ground.pitchMin, CAMERA.ground.pitchMax)
    return
  }
  refs.camYaw -= dx * sens
  refs.camPitch = THREE.MathUtils.clamp(refs.camPitch + dy * sens, CAMERA.pitchMin, CAMERA.pitchMax)
}

/** タッチの仮想右スティック：指を置いた点からのずれ（-1..1） */
const touchStick = { active: false, nx: 0, ny: 0 }

/**
 * 毎フレーム呼ぶ：スティックの倒し量を「速さ」にして視点／サイトを動かす（マウスと違い指を止めても回り続ける）
 */
export function touchLookTick(dt: number) {
  const c = CAMERA.touchStick
  if (!c.enabled || !touchStick.active) return
  const len = Math.hypot(touchStick.nx, touchStick.ny)
  if (len < c.deadZone) return
  // あそびを引いた上で 0..1 に直し、カーブをかける
  const k = Math.pow(Math.min(1, (len - c.deadZone) / (1 - c.deadZone)), c.curve) / len
  const sx = touchStick.nx * k
  const sy = touchStick.ny * k
  // dx/dy は「マウス px 相当」：sens を掛けると rad になるよう逆算
  const yawPx = (sx * c.yawSpeed * dt) / CAMERA.touchSensitivity
  const pitchPx = (sy * c.pitchSpeed * dt) / CAMERA.touchSensitivity
  applyLook(yawPx, pitchPx, CAMERA.touchSensitivity, sx * c.reticleSpeed * dt, sy * c.reticleSpeed * dt)
}

export function bindMouse(el: HTMLElement): () => void {
  const apply = (dx: number, dy: number, sens: number) => applyLook(dx, dy, sens)
  let dragging = false
  let lastX = 0
  let lastY = 0
  let touchId: number | null = null
  let touchX0 = 0
  let touchY0 = 0

  const onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement === el) apply(e.movementX, e.movementY, CAMERA.mouseSensitivity)
    else if (dragging) apply(e.movementX, e.movementY, CAMERA.mouseSensitivity)
  }
  const onMouseDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('.stick, .buttons, .tune, .overlay, .skillbar, .menu-btn')) return
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
      if (target?.closest('.stick, .buttons, .tune, .skillbar, .menu-btn, .overlay')) continue
      if (touchId === null) {
        touchId = t.identifier
        lastX = touchX0 = t.clientX
        lastY = touchY0 = t.clientY
        touchStick.active = true
        touchStick.nx = touchStick.ny = 0
        refs.lastLookInput = performance.now()
      }
    }
  }
  const onTouchMove = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== touchId) continue
      if (CAMERA.touchStick.enabled) {
        // 仮想スティック：置いた点からのずれを -1..1 に（円の外は 1）
        const r = CAMERA.touchStick.radius
        const [ax, ay] = screenToApp(t.clientX - touchX0, t.clientY - touchY0)
        let nx = ax / r
        let ny = ay / r
        const len = Math.hypot(nx, ny)
        if (len > 1) {
          nx /= len
          ny /= len
        }
        touchStick.nx = nx
        touchStick.ny = ny
      } else {
        const [ax, ay] = screenToApp(t.clientX - lastX, t.clientY - lastY)
        apply(ax, ay, CAMERA.touchSensitivity)
      }
      lastX = t.clientX
      lastY = t.clientY
    }
  }
  const onTouchEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== touchId) continue
      touchId = null
      touchStick.active = false
      touchStick.nx = touchStick.ny = 0
    }
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
