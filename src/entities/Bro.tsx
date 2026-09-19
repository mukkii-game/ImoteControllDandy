import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BRO, SCALE, LOCKON, IMOUTO } from '../config/game'
import { enemies, killEnemy, lock, clearLocks } from '../systems/enemies'
import { DUMMY_ENEMIES } from '../config/game'
import { useModels, candidates } from '../systems/models'
import { readMove, useInput } from '../systems/input'
import { refs, shoulderWorld } from '../systems/refs'
import { useGame } from '../systems/store'
import { useVRM } from '../systems/loaders'
import { emit } from '../systems/events'
import { applyWalk, applyShoulderPose, applyFlyPose, applyPunchPose } from '../systems/procAnim'

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
  /** 肩上の指示：null=腕組み, 0=前, -1=左, 1=右 */
  const steer = useRef<number | null>(null)
  const poseBlend = useRef(0)
  /** 投擲シーケンス */
  const throwSeq = useRef<{ targets: number[]; idx: number; phase: 'windup' | 'fly' | 'pause' | 'return'; t: number; from: THREE.Vector3; hits: number }>({
    targets: [],
    idx: 0,
    phase: 'windup',
    t: 0,
    from: new THREE.Vector3(),
    hits: 0,
  })
  const wasA = useRef(false)
  const punchT = useRef(0)
  const selected = useModels((s) => s.bro)
  const setResolved = useModels((s) => s.setResolved)
  const { vrm, choice } = useVRM(candidates('bro', selected))
  const setLoaded = useGame((s) => s.setLoaded)
  const tuneVersion = useGame((s) => s.tuneVersion)

  const modelHeight = useMemo(() => {
    if (!vrm) return 1
    const box = new THREE.Box3().setFromObject(vrm.scene)
    return box.max.y - box.min.y
  }, [vrm])
  const scale = SCALE.broHeight / modelHeight
  void tuneVersion

  useEffect(() => {
    refs.bro = group.current
    return () => {
      refs.bro = null
    }
  }, [])

  useEffect(() => {
    if (!vrm) return
    // モデルごとの非表示・色替え（Seed-san の学生服風など）
    const tint = new THREE.Color(choice?.tintColor ?? '#ffffff')
    const hide = choice?.hideMaterials ?? []
    const tints = choice?.tintMaterials ?? []
    vrm.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        const name = m.name ?? ''
        if (hide.some((k) => name.includes(k))) mesh.visible = false
        if (tints.some((k) => name.includes(k))) {
          const mm = m as THREE.Material & { color?: THREE.Color; shadeColorFactor?: THREE.Color }
          mm.color?.copy(tint)
          mm.shadeColorFactor?.copy(tint).multiplyScalar(0.55)
        }
      }
    })
    setLoaded('bro')
    if (choice) setResolved('bro', choice)
  }, [vrm, choice, setLoaded, setResolved])

  useFrame((_, dt) => {
    const g = group.current
    const st = useGame.getState()
    const input = useInput.getState()
    const playing = st.phase === 'play'
    const pressedB = playing && input.consumeB()
    const pressedA = playing && input.consumeA()
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
          // 近くに敵がいればパンチ（自動ロックオン）、いなければジャンプ
          let best: (typeof enemies)[number] | null = null
          let bd = BRO.punchRange
          for (const e of enemies) {
            if (!e.alive || e.pos.y > 30) continue
            const d = Math.hypot(e.pos.x - g.position.x, e.pos.z - g.position.z)
            if (d < bd) {
              bd = d
              best = e
            }
          }
          if (best) {
            yawRef.current = Math.atan2(best.pos.x - g.position.x, best.pos.z - g.position.z)
            g.position.x += Math.sin(yawRef.current) * Math.min(bd, 6)
            g.position.z += Math.cos(yawRef.current) * Math.min(bd, 6)
            killEnemy(best.id)
            emit('enemy.hit', { id: best.id, x: best.pos.x, y: best.pos.y, z: best.pos.z })
            st.addScore(100)
            punchT.current = 0.35
          } else {
            vy.current = BRO.jumpVelocity
            emit('bro.jump', undefined)
          }
        }
        punchT.current = Math.max(0, punchT.current - dt)
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
        // 肩上は常に腕組み（指差しは一旦オフ。BRO.pointWhileSteering で復活）
        const m = readMove()
        steer.current = BRO.pointWhileSteering ? (m.y > 0.2 ? (m.x > 0.3 ? 1 : m.x < -0.3 ? -1 : 0) : m.x > 0.3 ? 1 : m.x < -0.3 ? -1 : m.y > 0.2 ? 0 : null) : null
        // A を離した瞬間、ロックがあれば投擲開始
        const aNow = input.keys.a && playing
        if (wasA.current && !aNow && lock.ids.length > 0) {
          const seq = throwSeq.current
          seq.targets = [...lock.ids]
          seq.idx = 0
          seq.phase = 'windup'
          seq.t = 0
          seq.hits = 0
          seq.from.copy(g.position)
          clearLocks()
          st.setMode('thrown')
          emit('bro.throw', { count: seq.targets.length })
        }
        wasA.current = aNow
        if (pressedB) {
          refs.mountStart.copy(g.position)
          st.setTransition(0)
          st.setMode('dismounting')
          emit('bro.dismount', undefined)
        }
        break
      }
      case 'thrown': {
        const seq = throwSeq.current
        seq.t += dt
        moving = 1
        const nextTarget = () => {
          while (seq.idx < seq.targets.length) {
            const e = enemies.find((x) => x.id === seq.targets[seq.idx])
            if (e && e.alive) return e
            seq.idx++
          }
          return null
        }
        if (seq.phase === 'windup') {
          // 妹の肩で一瞬タメ（妹の腕が振りかぶる時間）。位置は肩に追従
          shoulderWorld(v)
          g.position.copy(v)
          g.position.y += Math.sin(Math.min(1, seq.t / LOCKON.windupSec) * Math.PI) * 4
          if (seq.t >= LOCKON.windupSec) {
            seq.phase = 'fly'
            seq.t = 0
            seq.from.copy(g.position)
          }
        } else if (seq.phase === 'fly') {
          const e = nextTarget()
          if (!e) {
            seq.phase = 'return'
            seq.t = 0
            seq.from.copy(g.position)
          } else {
            const dist = seq.from.distanceTo(e.pos)
            const dur = Math.max(0.12, dist / LOCKON.flySpeed)
            const k = Math.min(1, seq.t / dur)
            g.position.lerpVectors(seq.from, e.pos, k)
            // 少し弧を描く
            g.position.y += Math.sin(k * Math.PI) * Math.min(25, dist * 0.12)
            const dx = e.pos.x - seq.from.x
            const dz = e.pos.z - seq.from.z
            if (Math.hypot(dx, dz) > 0.5) yawRef.current = Math.atan2(dx, dz)
            if (k >= 1) {
              killEnemy(e.id, e.kind === 'dummy' ? DUMMY_ENEMIES.respawnSec : 0)
              seq.hits++
              emit('enemy.hit', { id: e.id, x: e.pos.x, y: e.pos.y, z: e.pos.z })
              seq.idx++
              seq.phase = 'pause'
              seq.t = 0
              seq.from.copy(g.position)
            }
          }
        } else if (seq.phase === 'pause') {
          if (seq.t >= LOCKON.hitPauseSec) {
            seq.phase = nextTarget() ? 'fly' : 'return'
            seq.t = 0
            seq.from.copy(g.position)
          }
        } else if (seq.phase === 'return') {
          const k = Math.min(1, seq.t / LOCKON.returnSec)
          shoulderWorld(target)
          const e = easeInOut(k)
          g.position.lerpVectors(seq.from, target, e)
          g.position.y += Math.sin(k * Math.PI) * SCALE.imoutoHeight * LOCKON.returnArc
          const dx = target.x - seq.from.x
          const dz = target.z - seq.from.z
          if (Math.hypot(dx, dz) > 1) yawRef.current = Math.atan2(dx, dz)
          if (k >= 1) {
            if (seq.hits > 0) {
              st.addScore(Math.round(100 * seq.hits * (seq.hits > 1 ? seq.hits * LOCKON.comboMulti : 1)))
              if (seq.hits > 1) st.setCombo(seq.hits)
            }
            st.setMode('shoulder')
            wasA.current = input.keys.a
            emit('bro.return', undefined)
          }
        }
        g.rotation.y = yawRef.current
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
      const onShoulder = st.mode === 'shoulder' || (st.mode === 'thrown' && throwSeq.current.phase === 'windup')
      poseBlend.current += ((onShoulder ? 1 : 0) - poseBlend.current) * Math.min(1, 8 * dt)
      if (st.mode === 'thrown' && throwSeq.current.phase !== 'windup') {
        // ライダーキック姿勢。飛行方向へ体を倒す
        applyFlyPose(vrm, dt)
        g.rotation.x = throwSeq.current.phase === 'return' ? -0.4 : 0.9
      } else if (poseBlend.current > 0.5) {
        g.rotation.x = 0
        applyShoulderPose(vrm, steer.current, dt)
      } else {
        g.rotation.x = 0
        runRatio.current += (moving - runRatio.current) * Math.min(1, 10 * dt)
        if (runRatio.current > 0.02) phase.current += (dt / BRO.stepPeriod) * Math.PI * 2 * Math.max(0.5, runRatio.current)
        applyWalk(vrm, phase.current, runRatio.current, BRO.walk, modelHeight)
        if (punchT.current > 0) applyPunchPose(vrm, 1 - punchT.current / 0.35)
      }
      vrm.update(dt)
    }
  })

  return (
    <group ref={group} position={[IMOUTO.spawn.x, 0, IMOUTO.spawn.z + 60]}>
      {vrm && <primitive object={vrm.scene} scale={scale} />}
    </group>
  )
}
