import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { POLICE, TANKS } from '../config/waves'
import { STAGE } from '../config/game'
import { addEnemy, killEnemy, isStunned, enemyObjects, type Enemy } from '../systems/enemies'
import { refs } from '../systems/refs'
import { emit, on } from '../systems/events'
import { toonGradient } from '../systems/toon'
import { useGame } from '../systems/store'
import { useKitModel } from '../systems/kit'
import { XrayRoot } from '../systems/xray'
import { addProjectile, removeProjectile, imoutoImpact, type Projectile } from '../systems/projectiles'
import { PROJECTILE } from '../config/waves'

const impact = new THREE.Vector3()

const m4 = new THREE.Matrix4()
const tmpV = new THREE.Vector3()

/** 最寄りの道路格子線に吸着 */
function snapToRoad(x: number, z: number): { x: number; z: number; alongX: boolean } {
  const half = (STAGE.blocks * STAGE.blockSize) / 2
  const B = STAGE.blockSize
  const rx = Math.round((x + half) / B) * B - half
  const rz = Math.round((z + half) / B) * B - half
  // 近い方の線に乗せる
  return Math.abs(rx - x) < Math.abs(rz - z) ? { x: rx, z, alongX: false } : { x, z: rz, alongX: true }
}

/**
 * パトカーと戦車。妹の進行方向の前方の道路上に配置し、踏まれる／投擲で壊れる。
 * 戦車は砲撃してくる。
 */
export function GroundEnemies() {
  const police = useRef<Enemy[]>([])
  const tanks = useRef<Enemy[]>([])
  const policeMesh = useRef<THREE.InstancedMesh>(null!)
  const lightMesh = useRef<THREE.InstancedMesh>(null!)
  const tankMesh = useRef<THREE.InstancedMesh>(null!)
  const shells = useRef<{ pos: THREE.Vector3; vel: THREE.Vector3; t: number; proj?: Projectile }[]>([])
  const shellTimer = useRef(TANKS.shellInterval)
  const lastSpawnDist = useRef(0)
  /** 戦車グループの出る側（+1 右 / -1 左）と、そのグループで出した数 */
  const tankSide = useRef(1)
  const tankGroupCount = useRef(0)
  /** パトカーの向き（id → yaw）と射撃タイマー */
  const policeYaw = useRef<Map<number, number>>(new Map())
  const policeShot = useRef(POLICE.shotInterval)
  const grad = useMemo(() => toonGradient(), [])
  const policeKit = useKitModel('police')
  const tankKit = useKitModel('tank')
  const policeGroups = useRef<THREE.Group[]>([])
  const tankGroups = useRef<THREE.Group[]>([])

  // 踏み潰し：妹の一歩で足元のパトカーを潰す
  useEffect(
    () =>
      on('imouto.step', ({ x, z }) => {
        let n = 0
        for (const e of police.current) {
          if (!e.alive) continue
          if (Math.hypot(e.pos.x - x, e.pos.z - z) < POLICE.stompRadius) {
            killEnemy(e.id)
            emit('enemy.hit', { id: e.id, x: e.pos.x, y: e.pos.y + 3, z: e.pos.z })
            n++
          }
        }
        if (n > 0) {
          const st = useGame.getState()
          st.addScore(50 * n * (n > 1 ? n : 1))
          if (n > 1) st.setCombo(n)
        }
      }),
    [],
  )

  useFrame((_, dt) => {
    const im = refs.imouto
    if (!im) return
    const yaw = im.rotation.y
    const fx = Math.sin(yaw)
    const fz = Math.cos(yaw)
    // 妹の前方に一定間隔で補充
    lastSpawnDist.current += dt * 22
    const alivePolice = police.current.filter((e) => e.alive)
    if (alivePolice.length < POLICE.max) {
      const d = POLICE.aheadMin + Math.random() * (POLICE.aheadMax - POLICE.aheadMin)
      const px = im.position.x + fx * d + (Math.random() - 0.5) * 60
      const pz = im.position.z + fz * d + (Math.random() - 0.5) * 60
      const s = snapToRoad(px, pz)
      const far = alivePolice.every((e) => Math.hypot(e.pos.x - s.x, e.pos.z - s.z) > 40)
      if (far) {
        const dead = police.current.find((e) => !e.alive)
        if (dead) {
          dead.pos.set(s.x, 2, s.z)
          dead.alive = true
        } else police.current.push(addEnemy('police', new THREE.Vector3(s.x, 2, s.z)))
      }
    }
    const aliveTanks = tanks.current.filter((e) => e.alive)
    // グループが全滅したら次のグループは反対側から（視線の誘導）
    if (aliveTanks.length === 0 && tankGroupCount.current > 0) {
      tankSide.current *= -1
      tankGroupCount.current = 0
    }
    if (im.position.z >= TANKS.fromZ && aliveTanks.length < TANKS.max && Math.random() < dt * 0.4) {
      tankGroupCount.current++
      const d = TANKS.aheadMin + Math.random() * (TANKS.aheadMax - TANKS.aheadMin)
      const side = tankSide.current * TANKS.side
      const px = im.position.x + fx * d + Math.cos(yaw) * side
      const pz = im.position.z + fz * d - Math.sin(yaw) * side
      const dead = tanks.current.find((e) => !e.alive)
      if (dead) {
        dead.pos.set(px, 3.5, pz)
        dead.alive = true
      } else tanks.current.push(addEnemy('tank', new THREE.Vector3(px, 3.5, pz)))
    }
    // パトカー AI：妹に keepDist まで近づいて撃つ。fleeDist より近づかれたら離れる
    const stunned = isStunned()
    for (const e of alivePolice) {
      const dx = im.position.x - e.pos.x
      const dz = im.position.z - e.pos.z
      const d = Math.hypot(dx, dz)
      if (d < 1) continue
      const mv = d > POLICE.keepDist + 20 ? 1 : d < POLICE.fleeDist ? -1 : 0
      if (mv !== 0 && !stunned) {
        const nx = (dx / d) * mv
        const nz = (dz / d) * mv
        e.pos.x += nx * POLICE.speed * dt
        e.pos.z += nz * POLICE.speed * dt
        policeYaw.current.set(e.id, Math.atan2(nx, nz))
      }
    }
    policeShot.current -= dt
    if (alivePolice.length > 0 && policeShot.current <= 0 && !stunned) {
      policeShot.current = POLICE.shotInterval
      const near = alivePolice.filter((e) => Math.hypot(e.pos.x - im.position.x, e.pos.z - im.position.z) < POLICE.keepDist + 80)
      if (near.length) {
        const s = near[Math.floor(Math.random() * near.length)]
        const target = tmpV.set(im.position.x + (Math.random() - 0.5) * 10, 8 + Math.random() * 40, im.position.z + (Math.random() - 0.5) * 8)
        const vel = target.clone().sub(s.pos).normalize().multiplyScalar(POLICE.shotSpeed)
        const sp = s.pos.clone().setY(3)
        shells.current.push({ pos: sp, vel, t: 0, proj: addProjectile(sp, PROJECTILE.hitRadius, 'missile', vel) })
      }
    }
    // 後ろに置き去りになった敵は消す
    for (const e of [...police.current, ...tanks.current]) {
      if (!e.alive) continue
      const dx = e.pos.x - im.position.x
      const dz = e.pos.z - im.position.z
      if (dx * fx + dz * fz < -250) e.alive = false
    }
    // 戦車の砲撃
    shellTimer.current -= dt
    if (aliveTanks.length > 0 && shellTimer.current <= 0 && !isStunned()) {
      shellTimer.current = TANKS.shellInterval
      const t = aliveTanks[Math.floor(Math.random() * aliveTanks.length)]
      const target = tmpV.set(im.position.x + (Math.random() - 0.5) * 10, 4 + Math.random() * 40, im.position.z + (Math.random() - 0.5) * 8)
      const vel = target.clone().sub(t.pos).normalize().multiplyScalar(TANKS.shellSpeed)
      const sp = t.pos.clone().setY(8)
      shells.current.push({ pos: sp, vel, t: 0, proj: addProjectile(sp, PROJECTILE.hitRadius, 'missile', vel) })
    }
    for (let i = shells.current.length - 1; i >= 0; i--) {
      const s = shells.current[i]
      s.t += dt
      s.pos.addScaledVector(s.vel, dt)
      const hit = !!imoutoImpact(s.pos, PROJECTILE.bodyRadius, impact)
      if (hit) emit('imouto.hit', { x: impact.x, y: impact.y, z: impact.z })
      if (hit || s.t > 14 || s.pos.y < 0 || s.proj?.dead) {
        removeProjectile(s.proj)
        shells.current.splice(i, 1)
      }
    }
    // 描画
    const write = (mesh: THREE.InstancedMesh, list: Enemy[], y: number, yawOf?: (e: Enemy) => number) => {
      let n = 0
      for (const e of list) {
        if (!e.alive) continue
        m4.makeRotationY(yawOf ? yawOf(e) : 0)
        m4.setPosition(e.pos.x, y, e.pos.z)
        mesh.setMatrixAt(n++, m4)
      }
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
    }
    if (policeKit) {
      policeMesh.current.count = 0
      lightMesh.current.count = 0
      const alive = police.current.filter((e) => e.alive)
      policeGroups.current.forEach((g, i) => {
        const e = alive[i]
        g.visible = !!e
        if (e) {
          enemyObjects.set(e.id, g)
          g.position.set(e.pos.x, 0, e.pos.z)
          g.rotation.y = policeYaw.current.get(e.id) ?? (snapToRoad(e.pos.x, e.pos.z).alongX ? Math.PI / 2 : 0)
        }
      })
    } else {
      write(policeMesh.current, police.current, POLICE.size.h / 2, (e) => policeYaw.current.get(e.id) ?? (snapToRoad(e.pos.x, e.pos.z).alongX ? Math.PI / 2 : 0))
      write(lightMesh.current, police.current, POLICE.size.h + 0.6)
    }
    if (tankKit) {
      tankMesh.current.count = 0
      const alive = tanks.current.filter((e) => e.alive)
      tankGroups.current.forEach((g, i) => {
        const e = alive[i]
        g.visible = !!e
        if (e) {
          enemyObjects.set(e.id, g)
          g.position.set(e.pos.x, 0, e.pos.z)
          g.rotation.y = yaw + Math.PI
        }
      })
    } else {
      write(tankMesh.current, tanks.current, TANKS.size.h / 2, () => yaw + Math.PI)
    }
    // （砲弾の見た目は entities/Projectiles.tsx が登録簿から描く）
  })

  return (
    <XrayRoot>
      {policeKit &&
        Array.from({ length: POLICE.max }, (_, i) => (
          <group key={`pk${i}`} ref={(el) => el && (policeGroups.current[i] = el)} visible={false}>
            <primitive object={policeKit.scene.clone()} />
          </group>
        ))}
      {tankKit &&
        Array.from({ length: TANKS.max }, (_, i) => (
          <group key={`tk${i}`} ref={(el) => el && (tankGroups.current[i] = el)} visible={false}>
            <primitive object={tankKit.scene.clone()} />
          </group>
        ))}
      <instancedMesh ref={policeMesh} args={[undefined, undefined, 32]} castShadow>
        <boxGeometry args={[POLICE.size.w, POLICE.size.h, POLICE.size.d]} />
        <meshToonMaterial color="#f5f5f5" gradientMap={grad} />
      </instancedMesh>
      <instancedMesh ref={lightMesh} args={[undefined, undefined, 32]}>
        <boxGeometry args={[POLICE.size.w * 0.8, 1.2, 2]} />
        <meshBasicMaterial color="#ff2a2a" />
      </instancedMesh>
      <instancedMesh ref={tankMesh} args={[undefined, undefined, 16]} castShadow>
        <boxGeometry args={[TANKS.size.w, TANKS.size.h, TANKS.size.d]} />
        <meshToonMaterial color="#6b7a4a" gradientMap={grad} />
      </instancedMesh>
    </XrayRoot>
  )
}
