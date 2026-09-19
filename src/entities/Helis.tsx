import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HELIS } from '../config/waves'
import { addEnemy, enemies, isStunned, type Enemy } from '../systems/enemies'
import { refs } from '../systems/refs'
import { emit } from '../systems/events'
import { toonGradient } from '../systems/toon'
import { useKitModel } from '../systems/kit'
import { XrayRoot } from '../systems/xray'
import { addProjectile, removeProjectile, imoutoImpact, type Projectile } from '../systems/projectiles'
import { PROJECTILE } from '../config/waves'

const impact = new THREE.Vector3()
import { useGame } from '../systems/store'

const tmp = new THREE.Vector3()
const lead = new THREE.Vector3()
const fwd = new THREE.Vector3()
const right = new THREE.Vector3()

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
  /** バルカンで撃ち落とせる登録（systems/projectiles） */
  proj?: Projectile
}

/**
 * ヘリ編隊。groups 個の編隊（各 perGroup 機）が、それぞれ妹の周りを一定距離で回りながら待機し、時々ミサイルを撃つ。
 * 編隊内の並びは HELIS.formation（ロロから見て横一列）。やられた機体は遠くから新しい機体が飛んできて編隊に戻る。
 */
export function Helis() {
  // 編隊数は品質プリセットで変わる（変わったら StageScene が key で作り直す）
  const TOTAL = HELIS.groups * HELIS.perGroup
  const groups = useRef<THREE.Group[]>([])
  const rotors = useRef<(THREE.Object3D | null)[]>([])
  const tails = useRef<(THREE.Object3D | null)[]>([])
  const ents = useRef<Enemy[]>([])
  /** 編隊ごとの旋回角 */
  const angle = useRef<number[]>([])
  const respawn = useRef<number[]>([])
  const vel = useRef<THREE.Vector3[]>([])
  const missiles = useRef<Missile[]>([])
  const fireTimer = useRef(HELIS.shotInterval)
  const seeds = useMemo(() => Array.from({ length: HELIS.groups }, () => Math.random()), [])

  useEffect(() => {
    for (let gI = 0; gI < HELIS.groups; gI++) angle.current[gI] = (gI / HELIS.groups) * Math.PI * 2
    const created = Array.from({ length: TOTAL }, (_, i) => {
      const e = addEnemy('heli', new THREE.Vector3(0, -1000, 0))
      e.alive = false
      respawn.current[i] = 0.5 + i * 0.4 // 少しずつ時間差で来る
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
    for (let gI = 0; gI < HELIS.groups; gI++) {
      // 編隊の先頭（妹の周りを回る点）と、その進行方向・ロロから見た横方向
      angle.current[gI] += HELIS.orbitSpeed * (stunned ? 0.2 : 1) * dt * (0.8 + 0.4 * Math.sin(seeds[gI] * 10 + angle.current[gI] * 0.5))
      const a = angle.current[gI]
      const wob = Math.sin(a * 1.7 + seeds[gI] * 6) * HELIS.heightSpread
      lead.set(im.position.x + Math.cos(a) * HELIS.keepDist, HELIS.height + wob + (seeds[gI] - 0.5) * HELIS.heightSpread, im.position.z + Math.sin(a) * HELIS.keepDist)
      fwd.set(-Math.sin(a), 0, Math.cos(a)) // 旋回の接線
      const dx = lead.x - im.position.x
      const dz = lead.z - im.position.z
      const l = Math.hypot(dx, dz) || 1
      right.set(dz / l, 0, -dx / l) // ロロから見て横
      for (let j = 0; j < HELIS.perGroup; j++) {
        const i = gI * HELIS.perGroup + j
        const e = ents.current[i]
        const g = groups.current[i]
        if (!e || !g) continue
        if (!e.alive) {
          // 再出現：遠くに置いて飛んでくる
          if (playing) respawn.current[i] -= dt
          if (respawn.current[i] <= 0) {
            e.alive = true
            respawn.current[i] = HELIS.respawnSec
            e.pos.set(im.position.x + Math.cos(a) * HELIS.spawnDist, HELIS.height + 40, im.position.z + Math.sin(a) * HELIS.spawnDist)
            vel.current[i].set(0, 0, 0)
          }
          g.visible = false
          continue
        }
        alive.push(e)
        const [fx, fy, fz] = HELIS.formation[j % HELIS.formation.length]
        tmp.copy(lead).addScaledVector(right, fx).addScaledVector(fwd, fz)
        tmp.y += fy
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
      }
    }
    // ミサイル
    fireTimer.current -= dt
    if (playing && alive.length > 0 && fireTimer.current <= 0 && !stunned) {
      fireTimer.current = HELIS.shotInterval
      const shooter = alive[Math.floor(Math.random() * alive.length)]
      const target = new THREE.Vector3(im.position.x + (Math.random() - 0.5) * 10, im.position.y + 10 + Math.random() * 45, im.position.z + (Math.random() - 0.5) * 8)
      const v = target.sub(shooter.pos).normalize().multiplyScalar(HELIS.shotSpeed)
      const mp = shooter.pos.clone()
      missiles.current.push({ pos: mp, vel: v, t: 0, proj: addProjectile(mp, PROJECTILE.hitRadius, 'missile', v) })
    }
    for (let i = missiles.current.length - 1; i >= 0; i--) {
      const ms = missiles.current[i]
      ms.t += dt
      ms.pos.addScaledVector(ms.vel, dt)
      const hit = !!imoutoImpact(ms.pos, PROJECTILE.bodyRadius, impact)
      if (hit) emit('imouto.hit', { x: impact.x, y: impact.y, z: impact.z })
      if (hit || ms.t > 12 || ms.pos.y < 0 || ms.proj?.dead) {
        removeProjectile(ms.proj)
        missiles.current.splice(i, 1)
      }
    }
    // （ミサイルの見た目は entities/Projectiles.tsx が登録簿から描く）
  })

  return (
    <XrayRoot>
      {Array.from({ length: TOTAL }, (_, i) => (
        <group key={i} ref={(el) => el && (groups.current[i] = el)} visible={false}>
          <HeliMesh rotor={(el) => (rotors.current[i] = el)} tail={(el) => (tails.current[i] = el)} />
        </group>
      ))}
    </XrayRoot>
  )
}
