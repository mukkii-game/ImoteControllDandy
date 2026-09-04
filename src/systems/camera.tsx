import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CAMERA } from '../config/game'
import { refs, shoulderWorld } from './refs'
import { useGame } from './store'

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
  // 兄の背後、腰の高さ
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
  // 肩の後方・やや外側・少し上
  pos.set(sw.x - fx * c.back + rx * c.side, sw.y + c.height, sw.z - fz * c.back + rz * c.side)
  // 前方の街を見下ろす
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
 * カメラシステム。地上／肩上の2モードと、その間の1秒演出（一気に上昇/降下）。
 */
export function CameraRig() {
  const { camera } = useThree()
  const init = useRef(false)
  const smoothedLook = useRef(new THREE.Vector3())

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

    if (!init.current) {
      camera.position.copy(desiredPos)
      smoothedLook.current.copy(desiredLook)
      init.current = true
    }
    const k = snap ? 1 : Math.min(1, CAMERA.followLerp * dt)
    camera.position.lerp(desiredPos, k)
    smoothedLook.current.lerp(desiredLook, k)
    camera.lookAt(smoothedLook.current)
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = THREE.MathUtils.lerp(cam.fov, fov, snap ? 1 : k)
      cam.updateProjectionMatrix()
    }
  })
  return null
}
