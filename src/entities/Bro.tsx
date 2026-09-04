import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BRO, CAMERA, SCALE } from '../config/game'
import { readMove, useInput } from '../systems/input'
import { refs, shoulderWorld } from '../systems/refs'
import { useGame } from '../systems/store'

const v = new THREE.Vector3()
const start = new THREE.Vector3()
const target = new THREE.Vector3()
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

/**
 * 兄（ステップ1：カプセル）。地上では WASD 移動、妹の足元で B を押すと肩まで登る。
 * 物理（Rapier）はステップ3で導入。今は平地キネマティック。
 */
export function Bro() {
  const group = useRef<THREE.Group>(null!)
  const yawRef = useRef(Math.PI) // 初期は妹の方（-Z）を向く
  const camYaw = useRef(0)

  useEffect(() => {
    refs.bro = group.current
    return () => {
      refs.bro = null
    }
  }, [])

  useFrame(({ camera }, dt) => {
    const g = group.current
    const st = useGame.getState()
    const pressedB = useInput.getState().consumeB()

    // 乗れる判定：妹の足元
    if (refs.imouto) {
      const d = Math.hypot(g.position.x - refs.imouto.position.x, g.position.z - refs.imouto.position.z)
      const can = st.mode === 'ground' && d < BRO.mountRadius
      if (can !== st.canMount) st.setCanMount(can)
    }

    switch (st.mode) {
      case 'ground': {
        const m = readMove()
        // カメラ基準の移動
        camYaw.current = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z)
        const yaw = camYaw.current + Math.PI
        const fx = Math.sin(yaw)
        const fz = Math.cos(yaw)
        const rx = Math.cos(yaw)
        const rz = -Math.sin(yaw)
        const dx = fx * m.y + rx * m.x
        const dz = fz * m.y + rz * m.x
        if (Math.abs(dx) + Math.abs(dz) > 0.001) {
          g.position.x += dx * BRO.walkSpeed * dt
          g.position.z += dz * BRO.walkSpeed * dt
          const want = Math.atan2(dx, dz)
          let diff = want - yawRef.current
          diff = Math.atan2(Math.sin(diff), Math.cos(diff))
          yawRef.current += diff * Math.min(1, BRO.turnLerp * dt)
        }
        g.position.y = 0
        g.rotation.y = yawRef.current
        if (pressedB && st.canMount) {
          start.copy(g.position)
          st.setTransition(0)
          st.setMode('mounting')
        }
        break
      }
      case 'mounting': {
        const t = Math.min(1, st.transition + dt / CAMERA.transitionSec)
        st.setTransition(t)
        shoulderWorld(target)
        const e = easeInOut(t)
        g.position.lerpVectors(start, target, e)
        // ジャンプ登りの放物線（上と外側に膨らませる）
        const yawI = refs.imouto?.rotation.y ?? 0
        const k = Math.sin(t * Math.PI)
        g.position.y += k * SCALE.imoutoHeight * 0.15
        g.position.x += Math.cos(yawI) * k * CAMERA.broPathSideBulge
        g.position.z += -Math.sin(yawI) * k * CAMERA.broPathSideBulge
        g.rotation.y = refs.imouto?.rotation.y ?? 0
        if (t >= 1) st.setMode('shoulder')
        break
      }
      case 'shoulder': {
        shoulderWorld(v)
        g.position.copy(v)
        g.rotation.y = refs.imouto?.rotation.y ?? 0
        if (pressedB) {
          start.copy(g.position)
          st.setTransition(0)
          st.setMode('dismounting')
        }
        break
      }
      case 'dismounting': {
        const t = Math.min(1, st.transition + dt / CAMERA.transitionSec)
        st.setTransition(t)
        // 妹の正面斜め前に飛び降りる
        const im = refs.imouto
        const yaw = im?.rotation.y ?? 0
        target.set(
          (im?.position.x ?? 0) + Math.sin(yaw) * BRO.mountRadius * 1.6 + Math.cos(yaw) * 6,
          0,
          (im?.position.z ?? 0) + Math.cos(yaw) * BRO.mountRadius * 1.6 - Math.sin(yaw) * 6,
        )
        const e = easeInOut(t)
        g.position.lerpVectors(start, target, e)
        g.position.y = start.y * (1 - e) + Math.sin(t * Math.PI) * 6
        if (t >= 1) {
          g.position.y = 0
          st.setMode('ground')
        }
        break
      }
    }
    refs.broYaw = yawRef.current
  })

  const h = SCALE.broHeight
  const r = SCALE.broRadius
  return (
    <group ref={group} position={[0, 0, 40]}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <capsuleGeometry args={[r, h - r * 2, 6, 12]} />
        <meshStandardMaterial color="#2ecc71" />
      </mesh>
      {/* マフラー（ライダー感） */}
      <mesh position={[0, h * 0.8, -0.35]} castShadow>
        <boxGeometry args={[0.5, 0.15, 0.6]} />
        <meshStandardMaterial color="#e74c3c" />
      </mesh>
      {/* 複眼 */}
      <mesh position={[-0.12, h * 0.85, r]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#ff3b3b" emissive="#ff3b3b" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0.12, h * 0.85, r]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#ff3b3b" emissive="#ff3b3b" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}
