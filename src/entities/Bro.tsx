import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BRO, MODELS, SCALE } from '../config/game'
import { readMove, useInput } from '../systems/input'
import { refs, shoulderWorld } from '../systems/refs'
import { useGame } from '../systems/store'
import { useVRM } from '../systems/loaders'
import { emit } from '../systems/events'
import { applyWalk } from '../systems/procAnim'

const v = new THREE.Vector3()
const target = new THREE.Vector3()
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * 兄。VRM の少年を学生服風に色替え。WASD はカメラ基準で移動、Space ジャンプ。
 * B（Shift）でどこからでも肩へ飛び乗り、肩上で B で飛び降りる。
 */
export function Bro() {
  const group = useRef<THREE.Group>(null!)
  const yawRef = useRef(Math.PI)
  const vy = useRef(0)
  const phase = useRef(0)
  const runRatio = useRef(0)
  const vrm = useVRM(MODELS.bro)
  const setLoaded = useGame((s) => s.setLoaded)

  const modelHeight = useMemo(() => {
    if (!vrm) return 1
    const box = new THREE.Box3().setFromObject(vrm.scene)
    return box.max.y - box.min.y
  }, [vrm])
  const scale = SCALE.broHeight / modelHeight

  useEffect(() => {
    refs.bro = group.current
    return () => {
      refs.bro = null
    }
  }, [])

  useEffect(() => {
    if (!vrm) return
    // 服・ロボ腕・バックパックを学生服色に寄せる（テクスチャに色を乗算）
    const tint = new THREE.Color(BRO.uniformColor)
    vrm.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        const name = m.name ?? ''
        if (BRO.hideMaterials.some((k) => name.includes(k))) mesh.visible = false
        if (BRO.tintMaterials.some((k) => name.includes(k))) {
          const mm = m as THREE.Material & { color?: THREE.Color; shadeColorFactor?: THREE.Color }
          mm.color?.copy(tint)
          mm.shadeColorFactor?.copy(tint).multiplyScalar(0.55)
        }
      }
    })
    setLoaded('bro')
  }, [vrm, setLoaded])

  useFrame((_, dt) => {
    const g = group.current
    const st = useGame.getState()
    const input = useInput.getState()
    const pressedB = input.consumeB()
    const pressedA = input.consumeA()
    let moving = 0

    switch (st.mode) {
      case 'ground': {
        const m = readMove()
        // カメラ基準：camYaw の向きが「前」
        const camYaw = refs.camYaw
        const fx = Math.sin(camYaw)
        const fz = Math.cos(camYaw)
        const rx = Math.cos(camYaw)
        const rz = -Math.sin(camYaw)
        const dx = fx * m.y + rx * m.x
        const dz = fz * m.y + rz * m.x
        const mag = Math.hypot(dx, dz)
        if (mag > 0.001) {
          const sp = BRO.runSpeed * Math.min(1, mag)
          g.position.x += (dx / mag) * sp * dt
          g.position.z += (dz / mag) * sp * dt
          const want = Math.atan2(dx, dz)
          let diff = want - yawRef.current
          diff = Math.atan2(Math.sin(diff), Math.cos(diff))
          yawRef.current += diff * Math.min(1, BRO.turnLerp * dt)
          moving = Math.min(1, mag)
        }
        const grounded = g.position.y <= 0.001
        if (pressedA && grounded) {
          vy.current = BRO.jumpVelocity
          emit('bro.jump', undefined)
        }
        vy.current -= BRO.gravity * dt
        g.position.y = Math.max(0, g.position.y + vy.current * dt)
        if (g.position.y <= 0) vy.current = Math.max(0, vy.current)
        g.rotation.y = yawRef.current

        if (pressedB && refs.shoulder) {
          refs.mountStart.copy(g.position)
          const d = refs.mountStart.distanceTo(shoulderWorld(v))
          refs.mountDuration = THREE.MathUtils.clamp(d / 120, BRO.mountSecMin, BRO.mountSecMax)
          st.setTransition(0)
          st.setMode('mounting')
          emit('bro.mount', undefined)
        }
        break
      }
      case 'mounting': {
        const t = Math.min(1, st.transition + dt / refs.mountDuration)
        st.setTransition(t)
        shoulderWorld(target)
        const e = easeInOut(t)
        g.position.lerpVectors(refs.mountStart, target, e)
        g.position.y += Math.sin(t * Math.PI) * SCALE.imoutoHeight * BRO.mountArc
        const dx = target.x - refs.mountStart.x
        const dz = target.z - refs.mountStart.z
        if (Math.hypot(dx, dz) > 1) yawRef.current = Math.atan2(dx, dz)
        g.rotation.y = yawRef.current
        g.rotation.x = -Math.sin(t * Math.PI) * 0.6
        moving = 1
        if (t >= 1) {
          g.rotation.x = 0
          st.setMode('shoulder')
        }
        break
      }
      case 'shoulder': {
        shoulderWorld(v)
        g.position.copy(v)
        yawRef.current = refs.imouto?.rotation.y ?? 0
        g.rotation.y = yawRef.current
        if (pressedB) {
          refs.mountStart.copy(g.position)
          st.setTransition(0)
          st.setMode('dismounting')
          emit('bro.dismount', undefined)
        }
        break
      }
      case 'dismounting': {
        const t = Math.min(1, st.transition + dt / BRO.dismountSec)
        st.setTransition(t)
        const im = refs.imouto
        const yaw = im?.rotation.y ?? 0
        target.set(
          (im?.position.x ?? 0) + Math.sin(yaw) * BRO.dismountAhead + Math.cos(yaw) * BRO.dismountSide,
          0,
          (im?.position.z ?? 0) + Math.cos(yaw) * BRO.dismountAhead - Math.sin(yaw) * BRO.dismountSide,
        )
        const e = easeOut(t)
        g.position.x = THREE.MathUtils.lerp(refs.mountStart.x, target.x, e)
        g.position.z = THREE.MathUtils.lerp(refs.mountStart.z, target.z, e)
        const up = Math.sin(Math.min(1, t * 2) * Math.PI * 0.5) * 6
        g.position.y = refs.mountStart.y * (1 - easeInOut(t)) + up * (1 - t)
        g.rotation.y = yaw
        moving = 1
        if (t >= 1) {
          g.position.y = 0
          vy.current = 0
          st.setMode('ground')
        }
        break
      }
    }
    refs.broYaw = yawRef.current

    if (vrm) {
      runRatio.current += (moving - runRatio.current) * Math.min(1, 10 * dt)
      if (runRatio.current > 0.02) phase.current += (dt / BRO.stepPeriod) * Math.PI * 2 * Math.max(0.5, runRatio.current)
      applyWalk(vrm, phase.current, runRatio.current, BRO.walk, modelHeight)
      vrm.update(dt)
    }
  })

  const h = SCALE.broHeight
  return (
    <group ref={group} position={[0, 0, 60]}>
      {vrm && <primitive object={vrm.scene} scale={scale} />}
      {/* マフラー（ライダー感）。後ろにたなびく */}
      <mesh position={[0, h * 0.84, -0.2]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.3, 0.08, 0.6]} />
        <meshToonMaterial color={BRO.scarfColor} />
      </mesh>
    </group>
  )
}
