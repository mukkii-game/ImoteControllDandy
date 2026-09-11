import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { IMOUTO, MODELS, SCALE } from '../config/game'
import { useVRM } from '../systems/loaders'
import { refs } from '../systems/refs'
import { useGame } from '../systems/store'
import { readMove } from '../systems/input'
import { emit } from '../systems/events'
import { applyWalk } from '../systems/procAnim'

/**
 * 妹。VRM を身長 60m にスケール。歩行は手続きアニメ。
 * 肩上モードのとき WASD でリモコン操作（前進／旋回）。地上モードでは立ち止まる。
 */
export function Imouto() {
  const group = useRef<THREE.Group>(null!)
  const vrm = useVRM(MODELS.imouto)
  const speed = useRef(0)
  const phase = useRef(0)
  const lastStepSide = useRef(0)
  const setLoaded = useGame((s) => s.setLoaded)

  const modelHeight = useMemo(() => {
    if (!vrm) return 1
    const box = new THREE.Box3().setFromObject(vrm.scene)
    return box.max.y - box.min.y
  }, [vrm])
  const scale = SCALE.imoutoHeight / modelHeight

  useEffect(() => {
    refs.imouto = group.current
    return () => {
      refs.imouto = null
      refs.shoulder = null
      refs.head = null
    }
  }, [])

  useEffect(() => {
    if (!vrm) return
    // VRM は +X が左。カメラを置く側（+X）に合わせて左肩に乗せる。upperArm が肩関節の位置
    const bone = vrm.humanoid.getNormalizedBoneNode('leftUpperArm')
    const anchor = new THREE.Object3D()
    const o = IMOUTO.shoulderOffset
    anchor.position.set(o.x, o.y, o.z)
    bone?.add(anchor)
    refs.shoulder = anchor
    refs.head = vrm.humanoid.getNormalizedBoneNode('head')
    setLoaded('imouto')
    return () => {
      anchor.removeFromParent()
    }
  }, [vrm, setLoaded])

  useFrame((_, dt) => {
    if (!vrm) return
    const g = group.current
    const mode = useGame.getState().mode
    const m = mode === 'shoulder' ? readMove() : { x: 0, y: 0 }

    g.rotation.y -= m.x * IMOUTO.turnSpeed * dt
    const targetSpeed = Math.max(0, m.y) * IMOUTO.walkSpeed
    speed.current += (targetSpeed - speed.current) * Math.min(1, IMOUTO.accel * dt)
    g.position.x += Math.sin(g.rotation.y) * speed.current * dt
    g.position.z += Math.cos(g.rotation.y) * speed.current * dt

    const walkRatio = speed.current / IMOUTO.walkSpeed
    if (walkRatio > 0.02) phase.current += (dt / IMOUTO.stepPeriod) * Math.PI * 2 * Math.max(0.4, walkRatio)
    applyWalk(vrm, phase.current, walkRatio, IMOUTO.walk, modelHeight)

    const side = Math.sign(Math.sin(phase.current))
    if (side !== 0 && side !== lastStepSide.current) {
      if (walkRatio > 0.3) emit('imouto.step', { strength: walkRatio * IMOUTO.stepShake, x: g.position.x, z: g.position.z })
      lastStepSide.current = side
    }
    vrm.update(dt)
  })

  return (
    <group ref={group} position={[IMOUTO.spawn.x, IMOUTO.spawn.y, IMOUTO.spawn.z]}>
      {vrm && <primitive object={vrm.scene} scale={scale} />}
    </group>
  )
}
