import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CAMERA } from '../config/game'
import { refs, shoulderWorld } from './refs'
import { useGame } from './store'
import { on } from './events'
import { useInput } from './input'

const desiredPos = new THREE.Vector3()
const desiredLook = new THREE.Vector3()
const groundPos = new THREE.Vector3()
const groundLook = new THREE.Vector3()
const shoulderPos = new THREE.Vector3()
const shoulderLook = new THREE.Vector3()
const tmp = new THREE.Vector3()
const thrownPos = new THREE.Vector3()
const thrownLook = new THREE.Vector3()
const headW = new THREE.Vector3()
const aimPos = new THREE.Vector3()
const aimLook = new THREE.Vector3()
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

/** 注視点を中心に、camYaw/camPitch のオービット位置を求める */
function orbit(center: THREE.Vector3, distance: number, pos: THREE.Vector3) {
  const yaw = refs.camYaw
  const pitch = refs.camPitch
  const cp = Math.cos(pitch)
  // camYaw は「カメラが向く方向」。カメラはその逆側に置く
  pos.set(center.x - Math.sin(yaw) * cp * distance, center.y + Math.sin(pitch) * distance, center.z - Math.cos(yaw) * cp * distance)
}

function computeGround(pos: THREE.Vector3, look: THREE.Vector3) {
  const b = refs.bro
  if (!b) return
  look.set(b.position.x, b.position.y + CAMERA.ground.targetHeight, b.position.z)
  orbit(look, CAMERA.ground.distance, pos)
  // 地面にめり込まない
  if (pos.y < 0.6) pos.y = 0.6
}

function computeShoulder(pos: THREE.Vector3, look: THREE.Vector3) {
  // 頭を中心に回す（パンツァードラグーン式）。横や後ろに回すと妹の顔が画面に入る
  if (refs.head) refs.head.getWorldPosition(tmp)
  else shoulderWorld(tmp)
  look.set(tmp.x, tmp.y + CAMERA.shoulder.targetHeight, tmp.z)
  orbit(look, CAMERA.shoulder.distance, pos)
}

/** 投擲中：兄と妹の頭の中間（兄寄り）を、二人を結ぶ線の横から見る。妹が必ず画面に入る */
const sideV = new THREE.Vector3()
function computeThrown(pos: THREE.Vector3, look: THREE.Vector3) {
  const b = refs.bro
  if (!b) return
  if (refs.head) refs.head.getWorldPosition(headW)
  else shoulderWorld(headW)
  const c = CAMERA.thrown
  look.lerpVectors(headW, b.position, c.broWeight)
  const sep = headW.distanceTo(b.position)
  const dist = c.distanceMin + sep * c.distanceK
  tmp.subVectors(b.position, headW)
  tmp.y = 0
  if (tmp.lengthSq() < 1) tmp.set(Math.sin(refs.camYaw), 0, Math.cos(refs.camYaw))
  tmp.normalize()
  // 兄→妹の線に対して横。現在のカメラ側（右/左）を保って急に回り込まない
  sideV.set(-tmp.z, 0, tmp.x)
  const cur = new THREE.Vector3().subVectors(refs.camPos, look)
  if (cur.dot(sideV) < 0) sideV.negate()
  pos.copy(look).addScaledVector(sideV, dist).addScaledVector(tmp, -dist * 0.35)
  pos.y = look.y + dist * c.heightK
  if (pos.y < 3) pos.y = 3
}

/** 乗降中に妹の体を突き抜けないよう、左肩側（+X）へ外側に膨らませる */
function bulge(pos: THREE.Vector3, t: number) {
  const yaw = refs.imouto?.rotation.y ?? 0
  const k = Math.sin(t * Math.PI) * CAMERA.transitionSideBulge
  pos.x += Math.cos(yaw) * k
  pos.z += -Math.sin(yaw) * k
}

/**
 * カメラシステム。地上／肩上ともマウスオービット。乗降時は両者を補間。妹の一歩でシェイク。
 */
export function CameraRig() {
  const { camera } = useThree()
  const init = useRef(false)
  const smoothedLook = useRef(new THREE.Vector3())
  const shake = useRef(0)
  const shakeT = useRef(0)
  const lastMode = useRef(useGame.getState().mode)
  const blendUntil = useRef(0)
  /** 地上発の攻撃中にカメラを留めておく位置 */
  const holdPos = useRef(new THREE.Vector3())
  /** 照準カメラへの寄り具合 0..1 */
  const aimK = useRef(0)

  useEffect(
    () =>
      on('imouto.step', ({ strength, x, z }) => {
        const mode = useGame.getState().mode
        let s = strength
        if (mode === 'ground' && refs.bro) {
          const d = Math.hypot(refs.bro.position.x - x, refs.bro.position.z - z)
          s *= THREE.MathUtils.clamp(1 - d / 250, 0.15, 1)
        } else {
          s *= 0.5
        }
        shake.current = Math.max(shake.current, s)
      }),
    [],
  )

  useFrame((_, dt) => {
    const st = useGame.getState()
    const cam = camera as THREE.PerspectiveCamera

    // モードが変わった瞬間にピッチをそのモードの既定値へ、yaw は妹の向きに合わせる
    if (st.mode !== lastMode.current) {
      if (st.mode === 'mounting') {
        // 乗った時は妹の左側から見る（兄が乗る肩と妹の横顔が見える）
        refs.camPitch = CAMERA.shoulder.defaultPitch
        refs.camYaw = (refs.imouto?.rotation.y ?? refs.camYaw) + CAMERA.mountViewYaw
      } else if (st.mode === 'dismounting') {
        refs.camPitch = CAMERA.ground.defaultPitch
      } else if (st.mode === 'shoulder' && lastMode.current === 'thrown') {
        if (CAMERA.thrown.enabled) {
          // 帰還直後：妹の正面向き・既定ピッチへ、なめらかに戻す
          refs.camYaw = refs.imouto?.rotation.y ?? refs.camYaw
          refs.camPitch = CAMERA.shoulder.defaultPitch
          blendUntil.current = performance.now() + CAMERA.thrown.blendBackSec * 1000
        }
      } else if (st.mode === 'thrown' && st.attackFrom === 'ground' && !CAMERA.thrown.enabled) {
        // 地上発：カメラはその場に留まり、飛ぶ兄を目で追う
        holdPos.current.copy(camera.position)
      } else if (st.mode === 'ground' && lastMode.current === 'thrown') {
        // 地上発の攻撃から着地：兄の向きで地上カメラへなめらかに戻す
        refs.camYaw = refs.broYaw
        refs.camPitch = CAMERA.ground.defaultPitch
        blendUntil.current = performance.now() + CAMERA.thrown.blendBackSec * 1000
      }
      lastMode.current = st.mode
    }

    // 地上：しばらくカメラを触らないと妹の方へゆっくり向く（妹が心配な兄）
    if (CAMERA.ground.pullEnabled && st.mode === 'ground' && refs.bro && refs.imouto && performance.now() - refs.lastLookInput > CAMERA.ground.pullDelaySec * 1000) {
      const dx = refs.imouto.position.x - refs.bro.position.x
      const dz = refs.imouto.position.z - refs.bro.position.z
      const want = Math.atan2(dx, dz)
      let diff = want - refs.camYaw
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      refs.camYaw += diff * Math.min(1, CAMERA.ground.pullLerp * dt)
      const wantPitch = -0.25
      refs.camPitch += (wantPitch - refs.camPitch) * Math.min(1, CAMERA.ground.pullLerp * 0.5 * dt)
    }
    computeGround(groundPos, groundLook)
    computeShoulder(shoulderPos, shoulderLook)
    // 溜め中（左クリック）は兄の近くへ寄る照準カメラ
    const aimWant = CAMERA.aim.cameraEnabled && st.charging && st.mode === 'shoulder' ? 1 : 0
    aimK.current += (aimWant - aimK.current) * Math.min(1, dt / CAMERA.aim.blendSec)
    const ak = aimK.current

    let fov: number = CAMERA.ground.fov
    let snap = false
    switch (st.mode) {
      case 'ground':
        desiredPos.copy(groundPos)
        desiredLook.copy(groundLook)
        if (ak > 0.001 && refs.bro) {
          aimLook.set(refs.bro.position.x, refs.bro.position.y + CAMERA.aim.height, refs.bro.position.z)
          orbit(aimLook, CAMERA.aim.groundDistance, aimPos)
          if (aimPos.y < 0.6) aimPos.y = 0.6
          desiredPos.lerp(aimPos, ak)
          desiredLook.lerp(aimLook, ak)
          fov = THREE.MathUtils.lerp(CAMERA.ground.fov, CAMERA.aim.fov, ak)
        }
        break
      case 'shoulder':
        desiredPos.copy(shoulderPos)
        desiredLook.copy(shoulderLook)
        fov = CAMERA.shoulder.fov
        if (ak > 0.001 && refs.bro) {
          aimLook.set(refs.bro.position.x, refs.bro.position.y + CAMERA.aim.height, refs.bro.position.z)
          orbit(aimLook, CAMERA.aim.distance, aimPos)
          desiredPos.lerp(aimPos, ak)
          desiredLook.lerp(aimLook, ak)
          fov = THREE.MathUtils.lerp(CAMERA.shoulder.fov, CAMERA.aim.fov, ak)
        }
        break
      case 'thrown':
        if (CAMERA.thrown.enabled) {
          computeThrown(thrownPos, thrownLook)
          desiredPos.copy(thrownPos)
          desiredLook.copy(thrownLook)
          fov = CAMERA.thrown.fov
        } else if (st.attackFrom === 'shoulder') {
          // 投擲中もカメラは変えない（肩上のまま。兄が画面から出ても追わない）
          desiredPos.copy(shoulderPos)
          desiredLook.copy(shoulderLook)
          fov = CAMERA.shoulder.fov
        } else {
          // 地上発：その場から兄を目で追う
          desiredPos.copy(holdPos.current)
          if (refs.bro) desiredLook.copy(refs.bro.position)
          fov = CAMERA.ground.fov
        }
        break
      case 'mounting': {
        const e = easeInOut(st.transition)
        desiredPos.lerpVectors(groundPos, shoulderPos, e)
        desiredLook.lerpVectors(groundLook, shoulderLook, e)
        bulge(desiredPos, st.transition)
        fov = THREE.MathUtils.lerp(CAMERA.ground.fov, CAMERA.shoulder.fov, e)
        snap = true
        break
      }
      case 'dismounting': {
        const e = easeInOut(st.transition)
        desiredPos.lerpVectors(shoulderPos, groundPos, e)
        desiredLook.lerpVectors(shoulderLook, groundLook, e)
        bulge(desiredPos, 1 - st.transition)
        fov = THREE.MathUtils.lerp(CAMERA.shoulder.fov, CAMERA.ground.fov, e)
        snap = true
        break
      }
    }

    if (st.phase === 'title' && refs.imouto && refs.bro) {
      // タイトル：画面下に兄、画面上にロロの顔（あくび）。妹の正面やや下から見上げる
      const im = refs.imouto.position
      const yaw = refs.imouto.rotation.y
      const fx = Math.sin(yaw)
      const fz = Math.cos(yaw)
      const c = CAMERA.title
      const want = new THREE.Vector3(im.x + fx * c.ahead + Math.cos(yaw) * c.side, c.height, im.z + fz * c.ahead - Math.sin(yaw) * c.side)
      const tgt = tmp.set(im.x + fx * c.lookAhead, c.lookHeight, im.z + fz * c.lookAhead)
      camera.position.lerp(want, Math.min(1, 3 * dt))
      smoothedLook.current.lerp(tgt, Math.min(1, 3 * dt))
      camera.lookAt(smoothedLook.current)
      if (Math.abs(cam.fov - c.fov) > 0.1) {
        cam.fov = THREE.MathUtils.lerp(cam.fov, c.fov, Math.min(1, 3 * dt))
        cam.updateProjectionMatrix()
      }
      init.current = false
      return
    }
    if ((st.phase === 'clear' || st.phase === 'late') && refs.imouto) {
      // ED：校庭の引き。妹の頭が校舎より上に見える構図
      // 妹の斜め前から、頭が校舎の屋根より上に見える引き
      const im = refs.imouto.position
      const tgt = tmp.set(im.x, 22, im.z + 20)
      const want = new THREE.Vector3(im.x - 95, 30, im.z - 80)
      camera.position.lerp(want, Math.min(1, 2 * dt))
      smoothedLook.current.lerp(tgt, Math.min(1, 2 * dt))
      camera.lookAt(smoothedLook.current)
      if (Math.abs(cam.fov - 50) > 0.1) {
        cam.fov = THREE.MathUtils.lerp(cam.fov, 50, Math.min(1, 2 * dt))
        cam.updateProjectionMatrix()
      }
      return
    }
    if (useInput.getState().overview && refs.imouto) {
      const im = st.mode === 'ground' && refs.bro ? refs.bro.position : refs.imouto.position
      const dist = st.mode === 'ground' ? 0.35 : 1
      camera.position.set(im.x + 160 * dist, 220 * dist, im.z - 260 * dist)
      camera.lookAt(im.x, 20 * dist, im.z)
      if (cam.fov !== 50) {
        cam.fov = 50
        cam.updateProjectionMatrix()
      }
      return
    }

    if (!init.current) {
      camera.position.copy(desiredPos)
      smoothedLook.current.copy(desiredLook)
      init.current = true
    }
    // オービットはマウス直結なので位置は即応、注視点だけ軽くなめらかに
    const k = snap ? 1 : Math.min(1, CAMERA.followLerp * dt)
    const throwCam = st.mode === 'thrown' && (CAMERA.thrown.enabled || st.attackFrom === 'ground')
    if (throwCam || performance.now() < blendUntil.current) {
      const kk = Math.min(1, CAMERA.thrown.followLerp * dt)
      camera.position.lerp(desiredPos, kk)
      smoothedLook.current.lerp(desiredLook, Math.min(1, kk * 2))
    } else if (st.mode === 'ground') {
      // 地上：位置も軽く追従させて、歩幅の刻みでカクつかないように
      camera.position.lerp(desiredPos, Math.min(1, 18 * dt))
      smoothedLook.current.lerp(desiredLook, Math.min(1, 14 * dt))
    } else {
      camera.position.copy(desiredPos)
      smoothedLook.current.lerp(desiredLook, snap ? 1 : Math.min(1, k * 3))
    }

    shake.current = Math.max(0, shake.current - CAMERA.shakeDecay * dt * shake.current - dt * 0.2)
    shakeT.current += dt * 40
    const amp = shake.current * CAMERA.shakeAmp * (st.mode === 'shoulder' ? 6 : 1)
    camera.position.x += Math.sin(shakeT.current * 1.3) * amp
    camera.position.y += Math.sin(shakeT.current * 1.7 + 1) * amp * 0.8
    camera.lookAt(smoothedLook.current)
    refs.camPos.copy(camera.position)

    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = THREE.MathUtils.lerp(cam.fov, fov, snap ? 1 : k)
      cam.updateProjectionMatrix()
    }
  })
  return null
}
