import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HELIS, HIT } from '../config/waves'
import { addEnemy, enemies, isStunned, type Enemy } from '../systems/enemies'
import { refs } from '../systems/refs'
import { emit } from '../systems/events'
import { toonGradient } from '../systems/toon'
import { useKitModel } from '../systems/kit'
import { useGame } from '../systems/store'

const m4 = new THREE.Matrix4()
const tmp = new THREE.Vector3()

/** ヘリの機体（プリミティブ：胴体・尾・メインローター・テールローター） */
function HeliMesh({ rotor, tail }: { rotor: (el: THREE.Object3D | null) => void; tail: (el: THREE.Object3D | null) => void }) {
  const s = HELIS.size
  const grad = toonGradient()
  const kit = useKitModel('heli')
  if (kit) return <primitive object={kit.scene.clone()} />
  return (
    <group>
      <mesh castShadow>
        <capsuleGeometry args={[s * 0.13, s * 0.3, 4, 10]} />
        <meshToonMaterial color="#3d6b3a" gradientMap={grad} />
      </mesh>
      <mesh position={[0, s * 0.05, s * 0.18]}>
        <sphereGeometry args={[s * 0.11, 10, 8]} />
        <meshToonMaterial color="#9ad0ff" gradientMap={grad} />
      </mesh>
      <mesh position={[0, s * 0.06, -s * 0.42]} castShadow>
        <boxGeometry args={[s * 0.06, s * 0.08, s * 0.5]} />
        <meshToonMaterial color="#35592f" gradientMap={grad} />
      </mesh>
      <mesh position={[0, -s * 0.16, 0]}>
        <boxGeometry args={[s * 0.3, s * 0.02, s * 0.36]} />
        <meshToonMaterial color="#222" gradientMap={grad} />
      </mesh>
      <group ref={rotor} position={[0, s * 0.2, 0]}>
        <mesh>
          <boxGeometry args={[s * 0.9, s * 0.015, s * 0.05]} />
          <meshToonMaterial color="#222" gradientMap={grad} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[s * 0.9, s * 0.015, s * 0.05]} />
          <meshToonMaterial color="#222" gradientMap={grad} />
        </mesh>
      </group>
      <group ref={tail} position={[s * 0.04, s * 0.1, -s * 0.66]}>
        <mesh rotation={[0, 0, 0]}>
          <boxGeometry args={[s * 0.01, s * 0.2, s * 0.03]} />
          <meshToonMaterial color="#222" gradientMap={grad} />
        </mesh>
      </group>
    </group>
  )
}

interface Missile {
  pos: THREE.Vector3
  vel: THREE.Vector3
  t: number
}

/**
 * ヘリ編隊。開始直後から妹の周りを一定距離で回りながら待機し、時々ミサイルを撃つ。
 * やられると遠くから新しい機体が飛んでくる。
 */
export function Helis() {
  const groups = useRef<THREE.Group[]>([])
  const rotors = useRef<(THREE.Object3D | null)[]>([])
  const tails = useRef<(THREE.Object3D | null)[]>([])
  const ents = useRef<Enemy[]>([])
  const angle = useRef<number[]>([])
  const respawn = useRef<number[]>([])
  const vel = useRef<THREE.Vector3[]>([])
  const missiles = useRef<Missile[]>([])
  const missileMesh = useRef<THREE.InstancedMesh>(null!)
  const fireTimer = useRef(HELIS.shotInterval)
  const seeds = useMemo(() => Array.from({ length: HELIS.count }, () => Math.random()), [])

  useEffect(() => {
    const created = Array.from({ length: HELIS.count }, (_, i) => {
      const e = addEnemy('heli', new THREE.Vector3(0, -1000, 0))
      e.alive = false
      angle.current[i] = (i / HELIS.count) * Math.PI * 2
      respawn.current[i] = 0.5 + i * 1.5 // 少しずつ時間差で来る
      vel.current[i] = new THREE.Vector3()
      return e
    })
    ents.current = created
    return () => {
      for (const e of created) {
        const i = enemies.indexOf(e)
        if (i >= 0) enemies.splice(i, 1)
      }
    }
  }, [])

  useFrame((_, dt) => {
    const im = refs.imouto
    if (!im) return
    const playing = useGame.getState().phase === 'play'
    const stunned = isStunned()
    const alive: Enemy[] = []
    ents.current.forEach((e, i) => {
      const g = groups.current[i]
      if (!g) return
      if (!e.alive) {
        // 再出現：遠くに置いて飛んでくる
        if (playing) respawn.current[i] -= dt
        if (respawn.current[i] <= 0) {
          e.alive = true
          respawn.current[i] = HELIS.respawnSec
          const a = angle.current[i]
          e.pos.set(im.position.x + Math.cos(a) * HELIS.spawnDist, HELIS.height + 40, im.position.z + Math.sin(a) * HELIS.spawnDist)
          vel.current[i].set(0, 0, 0)
        }
        g.visible = false
        return
      }
      alive.push(e)
      // 目標位置：妹の周りを回る点
      angle.current[i] += HELIS.orbitSpeed * (stunned ? 0.2 : 1) * dt * (0.8 + 0.4 * Math.sin(seeds[i] * 10 + angle.current[i] * 0.5))
      const a = angle.current[i]
      const wob = Math.sin(a * 1.7 + seeds[i] * 6) * HELIS.heightSpread
      tmp.set(im.position.x + Math.cos(a) * HELIS.keepDist, HELIS.height + wob + (seeds[i] - 0.5) * HELIS.heightSpread, im.position.z + Math.sin(a) * HELIS.keepDist)
      // なめらかに向かう（速度に上限）
      const to = tmp.sub(e.pos)
      const dist = to.length()
      const spd = Math.min(HELIS.speed * (stunned ? 0.3 : 1), dist * 1.2)
      if (dist > 0.01) to.normalize().multiplyScalar(spd)
      vel.current[i].lerp(to, Math.min(1, 2.5 * dt))
      e.pos.addScaledVector(vel.current[i], dt)
      g.position.copy(e.pos)
      // 向き：進行方向。傾き（バンク）は速度で
      const v = vel.current[i]
      if (Math.hypot(v.x, v.z) > 2) g.rotation.y = Math.atan2(v.x, v.z)
      g.rotation.z = THREE.MathUtils.clamp(-v.x * 0.004, -0.35, 0.35)
      g.rotation.x = THREE.MathUtils.clamp(Math.hypot(v.x, v.z) * 0.006, 0, 0.3)
      const r = rotors.current[i]
      if (r) r.rotation.y += HELIS.rotorSpeed * dt
      const t = tails.current[i]
      if (t) t.rotation.x += HELIS.rotorSpeed * 1.5 * dt
      g.visible = true
    })
    // ミサイル
    fireTimer.current -= dt
    if (playing && alive.length > 0 && fireTimer.current <= 0 && !stunned) {
      fireTimer.current = HELIS.shotInterval
      const shooter = alive[Math.floor(Math.random() * alive.length)]
      const target = new THREE.Vector3(im.position.x + (Math.random() - 0.5) * 10, im.position.y + 10 + Math.random() * 45, im.position.z + (Math.random() - 0.5) * 8)
      const v = target.sub(shooter.pos).normalize().multiplyScalar(HELIS.shotSpeed)
      missiles.current.push({ pos: shooter.pos.clone(), vel: v, t: 0 })
    }
    for (let i = missiles.current.length - 1; i >= 0; i--) {
      const ms = missiles.current[i]
      ms.t += dt
      ms.pos.addScaledVector(ms.vel, dt)
      const hit = Math.hypot(ms.pos.x - im.position.x, ms.pos.z - im.position.z) < HIT.radius * 0.5 && ms.pos.y > 0 && ms.pos.y < 60
      if (hit) emit('imouto.hit', { x: ms.pos.x, y: ms.pos.y, z: ms.pos.z })
      if (hit || ms.t > 6 || ms.pos.y < 0) missiles.current.splice(i, 1)
    }
    missileMesh.current.count = missiles.current.length
    missiles.current.forEach((ms, i) => {
      m4.identity()
      m4.setPosition(ms.pos)
      missileMesh.current.setMatrixAt(i, m4)
    })
    missileMesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {Array.from({ length: HELIS.count }, (_, i) => (
        <group key={i} ref={(el) => el && (groups.current[i] = el)} visible={false}>
          <HeliMesh rotor={(el) => (rotors.current[i] = el)} tail={(el) => (tails.current[i] = el)} />
        </group>
      ))}
      <instancedMesh ref={missileMesh} args={[undefined, undefined, 32]}>
        <sphereGeometry args={[1.6, 8, 8]} />
        <meshBasicMaterial color="#ffb347" />
      </instancedMesh>
    </group>
  )
}
