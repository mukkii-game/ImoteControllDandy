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
        refs.camPitch = CAMERA.shoulder.defaultPitch
        refs.camYaw = refs.imouto?.rotation.y ?? refs.camYaw
      } else if (st.mode === 'dismounting') {
        refs.camPitch = CAMERA.ground.defaultPitch
      }
      lastMode.current = st.mode
    }

    computeGround(groundPos, groundLook)
    computeShoulder(shoulderPos, shoulderLook)

    let fov: number = CAMERA.ground.fov
    let snap = false
    switch (st.mode) {
      case 'ground':
        desiredPos.copy(groundPos)
        desiredLook.copy(groundLook)
        break
      case 'shoulder':
        desiredPos.copy(shoulderPos)
        desiredLook.copy(shoulderLook)
        fov = CAMERA.shoulder.fov
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
    camera.position.copy(desiredPos)
    smoothedLook.current.lerp(desiredLook, snap ? 1 : Math.min(1, k * 3))

    shake.current = Math.max(0, shake.current - CAMERA.shakeDecay * dt * shake.current - dt * 0.2)
    shakeT.current += dt * 40
    const amp = shake.current * CAMERA.shakeAmp * (st.mode === 'shoulder' ? 6 : 1)
    camera.position.x += Math.sin(shakeT.current * 1.3) * amp
    camera.position.y += Math.sin(shakeT.current * 1.7 + 1) * amp * 0.8
    camera.lookAt(smoothedLook.current)

    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = THREE.MathUtils.lerp(cam.fov, fov, snap ? 1 : k)
      cam.updateProjectionMatrix()
    }
  })
  return null
}
