import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VRM } from '@pixiv/three-vrm'
import { IMOUTO, MODELS, SCALE } from '../config/game'
import { useVRM } from '../systems/loaders'
import { refs } from '../systems/refs'
import { useGame } from '../systems/store'
import { readMove } from '../systems/input'
import { emit } from '../systems/events'

/**
 * 妹。VRM を身長 60m にスケール。歩行は手続きアニメ（脚・腕・上下動）。
 * 肩上モードのとき WASD で前進／旋回。地上モードでは立ち止まる。
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
    }
  }, [])

  useEffect(() => {
    if (!vrm) return
    // VRM は +X が左。カメラを置く側（+X）に合わせて左肩に乗せる
    const shoulderBone = vrm.humanoid.getNormalizedBoneNode('leftShoulder') ?? vrm.humanoid.getNormalizedBoneNode('leftUpperArm')
    const anchor = new THREE.Object3D()
    const o = IMOUTO.shoulderOffset
    anchor.position.set(o.x, o.y, o.z)
    shoulderBone?.add(anchor)
    refs.shoulder = anchor
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

    // 旋回（左右）
    g.rotation.y -= m.x * IMOUTO.turnSpeed * dt
    // 前進（W で加速、S で減速）
    const targetSpeed = Math.max(0, m.y) * IMOUTO.walkSpeed
    speed.current += (targetSpeed - speed.current) * Math.min(1, IMOUTO.accel * dt)
    g.position.x += Math.sin(g.rotation.y) * speed.current * dt
    g.position.z += Math.cos(g.rotation.y) * speed.current * dt

    // 歩行位相（速度に比例）
    const walkRatio = speed.current / IMOUTO.walkSpeed
    if (walkRatio > 0.02) phase.current += (dt / IMOUTO.stepPeriod) * Math.PI * 2 * Math.max(0.4, walkRatio)
    const p = phase.current
    const swing = Math.sin(p) * IMOUTO.legSwing * walkRatio
    const h = vrm.humanoid
    const set = (name: Parameters<typeof h.getNormalizedBoneNode>[0], x: number, y = 0, z = 0) => {
      const n = h.getNormalizedBoneNode(name)
      if (n) n.rotation.set(x, y, z)
    }
    // 脚：前後に振る。膝は後ろに引くときに曲げる
    set('leftUpperLeg', swing)
    set('rightUpperLeg', -swing)
    set('leftLowerLeg', Math.max(0, -Math.sin(p)) * IMOUTO.kneeBend * walkRatio)
    set('rightLowerLeg', Math.max(0, Math.sin(p)) * IMOUTO.kneeBend * walkRatio)
    // 腕：脚と逆位相。自然に下ろした姿勢（Tポーズから下げる）
    const armDown = 1.25
    set('leftUpperArm', -swing * (IMOUTO.armSwing / IMOUTO.legSwing), 0, -armDown)
    set('rightUpperArm', swing * (IMOUTO.armSwing / IMOUTO.legSwing), 0, armDown)
    set('leftLowerArm', 0, 0, -0.25)
    set('rightLowerArm', 0, 0, 0.25)
    // 体の上下動と、歩きのときの前傾
    const hips = h.getNormalizedBoneNode('hips')
    if (hips) {
      hips.position.y = (hips.userData.baseY ??= hips.position.y) + Math.abs(Math.cos(p)) * IMOUTO.bodyBob * modelHeight * walkRatio
    }
    set('spine', 0.06 * walkRatio)

    // 着地イベント：脚が最前→接地のタイミング（sin の符号が変わる瞬間）
    const side = Math.sign(Math.sin(p))
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

export type { VRM }
