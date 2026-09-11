import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { BRO, MODELS, SCALE } from '../config/game'
import { readMove, useInput } from '../systems/input'
import { refs, shoulderWorld } from '../systems/refs'
import { useGame } from '../systems/store'
import { loadGLTF } from '../systems/loaders'
import { toonMaterial } from '../systems/toon'
import { emit } from '../systems/events'

const v = new THREE.Vector3()
const target = new THREE.Vector3()
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

type Clip = 'idle' | 'walk' | 'run'

/**
 * 兄。Xbot をトゥーン塗りしてレトロヒーロー風に。WASD 直接操作、Space ジャンプ。
 * B（Shift）でどこからでも肩へ飛び乗り、肩上で B で飛び降りる。
 */
export function Bro() {
  const group = useRef<THREE.Group>(null!)
  const yawRef = useRef(Math.PI)
  const vy = useRef(0)
  const [model, setModel] = useState<THREE.Object3D | null>(null)
  const mixer = useRef<THREE.AnimationMixer | null>(null)
  const actions = useRef<Record<Clip, THREE.AnimationAction> | null>(null)
  const current = useRef<Clip>('idle')
  const setLoaded = useGame((s) => s.setLoaded)

  useEffect(() => {
    refs.bro = group.current
    return () => {
      refs.bro = null
    }
  }, [])

  useEffect(() => {
    let alive = true
    loadGLTF(MODELS.bro).then((g) => {
      if (!alive) return
      const s = SkeletonUtils.clone(g.scene) as THREE.Object3D
      const suit = toonMaterial(BRO.suitColor)
      const joint = toonMaterial(BRO.jointColor)
      s.traverse((o) => {
        const mesh = o as THREE.SkinnedMesh
        if (mesh.isMesh) {
          mesh.castShadow = true
          mesh.frustumCulled = false
          mesh.material = /joint/i.test(mesh.name) ? joint : suit
        }
      })
      const mx = new THREE.AnimationMixer(s)
      const pick = (n: string) => g.animations.find((a) => a.name === n)!
      actions.current = {
        idle: mx.clipAction(pick('idle')),
        walk: mx.clipAction(pick('walk')),
        run: mx.clipAction(pick('run')),
      }
      actions.current.idle.play()
      mixer.current = mx
      setModel(s)
      setLoaded('bro')
    })
    return () => {
      alive = false
    }
  }, [setLoaded])

  const play = (c: Clip) => {
    if (!actions.current || current.current === c) return
    const from = actions.current[current.current]
    const to = actions.current[c]
    to.reset().play()
    from.crossFadeTo(to, 0.15, false)
    current.current = c
  }

  useFrame(({ camera }, dt) => {
    const g = group.current
    const st = useGame.getState()
    const input = useInput.getState()
    const pressedB = input.consumeB()
    const pressedA = input.consumeA()

    switch (st.mode) {
      case 'ground': {
        const m = readMove()
        const camYaw = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z) + Math.PI
        const fx = Math.sin(camYaw)
        const fz = Math.cos(camYaw)
        const rx = Math.cos(camYaw)
        const rz = -Math.sin(camYaw)
        const dx = fx * m.y + rx * m.x
        const dz = fz * m.y + rz * m.x
        const mag = Math.hypot(dx, dz)
        const speed = BRO.runSpeed
        if (mag > 0.001) {
          g.position.x += (dx / mag) * speed * Math.min(1, mag) * dt
          g.position.z += (dz / mag) * speed * Math.min(1, mag) * dt
          const want = Math.atan2(dx, dz)
          let diff = want - yawRef.current
          diff = Math.atan2(Math.sin(diff), Math.cos(diff))
          yawRef.current += diff * Math.min(1, BRO.turnLerp * dt)
        }
        // ジャンプ／重力
        const grounded = g.position.y <= 0.001
        if (pressedA && grounded) {
          vy.current = BRO.jumpVelocity
          emit('bro.jump', undefined)
        }
        vy.current -= BRO.gravity * dt
        g.position.y = Math.max(0, g.position.y + vy.current * dt)
        if (g.position.y <= 0) vy.current = Math.max(0, vy.current)
        g.rotation.y = yawRef.current
        play(mag > 0.001 ? (mag > 0.6 ? 'run' : 'walk') : 'idle')

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
        // 進行方向を向く
        const dx = target.x - refs.mountStart.x
        const dz = target.z - refs.mountStart.z
        if (Math.hypot(dx, dz) > 1) yawRef.current = Math.atan2(dx, dz)
        g.rotation.y = yawRef.current
        g.rotation.x = -Math.sin(t * Math.PI) * 0.6 // 飛んでる感
        play('run')
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
        play('idle')
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
        // 一度ふわっと上がってから落ちる
        const up = Math.sin(Math.min(1, t * 2) * Math.PI * 0.5) * 6
        g.position.y = refs.mountStart.y * (1 - easeInOut(t)) + up * (1 - t)
        g.rotation.y = yaw
        play('run')
        if (t >= 1) {
          g.position.y = 0
          vy.current = 0
          st.setMode('ground')
        }
        break
      }
    }
    refs.broYaw = yawRef.current
    mixer.current?.update(dt)
  })

  const h = SCALE.broHeight
  return (
    <group ref={group} position={[0, 0, 60]}>
      {model && <primitive object={model} />}
      {/* マフラー（ライダー感）。後ろにたなびく箱 */}
      <mesh position={[0, h * 0.82, -0.22]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.36, 0.1, 0.7]} />
        <meshToonMaterial color={BRO.scarfColor} />
      </mesh>
      <mesh position={[0, h * 0.86, -0.05]} castShadow>
        <torusGeometry args={[0.15, 0.05, 6, 12]} />
        <meshToonMaterial color={BRO.scarfColor} />
      </mesh>
    </group>
  )
}
