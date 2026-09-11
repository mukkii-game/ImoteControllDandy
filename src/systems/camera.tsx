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
const sw = new THREE.Vector3()
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

function computeGround(pos: THREE.Vector3, look: THREE.Vector3) {
  const b = refs.bro
  if (!b) return
  const c = CAMERA.ground
  const yaw = refs.broYaw
  pos.set(b.position.x - Math.sin(yaw) * c.back, b.position.y + c.height, b.position.z - Math.cos(yaw) * c.back)
  look.set(b.position.x + Math.sin(yaw) * c.lookAhead, b.position.y + c.lookHeight, b.position.z + Math.cos(yaw) * c.lookAhead)
}

function computeShoulder(pos: THREE.Vector3, look: THREE.Vector3) {
  const im = refs.imouto
  if (!im) return
  const c = CAMERA.shoulder
  const yaw = im.rotation.y
  shoulderWorld(sw)
  const fx = Math.sin(yaw)
  const fz = Math.cos(yaw)
  const rx = Math.cos(yaw)
  const rz = -Math.sin(yaw)
  pos.set(sw.x - fx * c.back + rx * c.side, sw.y + c.height, sw.z - fz * c.back + rz * c.side)
  look.set(sw.x + fx * c.lookDownDistance, sw.y - c.lookDownDrop, sw.z + fz * c.lookDownDistance)
}

/** 妹の右側（肩側）へ外側に膨らませる。t: 0..1 */
function bulge(pos: THREE.Vector3, t: number) {
  const yaw = refs.imouto?.rotation.y ?? 0
  const k = Math.sin(t * Math.PI) * CAMERA.transitionSideBulge
  pos.x += Math.cos(yaw) * k
  pos.z += -Math.sin(yaw) * k
}

/**
 * カメラシステム。地上／肩上の2モードと、その間の演出。妹の一歩でシェイク。
 */
export function CameraRig() {
  const { camera } = useThree()
  const init = useRef(false)
  const smoothedLook = useRef(new THREE.Vector3())
  const shake = useRef(0)
  const shakeT = useRef(0)

  useEffect(
    () =>
      on('imouto.step', ({ strength, x, z }) => {
        // 地上では距離で減衰。肩上では常に少し揺れる
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
      // デバッグ俯瞰：妹の斜め上から全体を見る
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
    const k = snap ? 1 : Math.min(1, CAMERA.followLerp * dt)
    camera.position.lerp(desiredPos, k)
    smoothedLook.current.lerp(desiredLook, k)

    // シェイク
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
