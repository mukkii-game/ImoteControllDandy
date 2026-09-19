import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { POLICE, TANKS, HIT } from '../config/waves'
import { STAGE } from '../config/game'
import { addEnemy, killEnemy, isStunned, type Enemy } from '../systems/enemies'
import { refs } from '../systems/refs'
import { emit, on } from '../systems/events'
import { toonGradient } from '../systems/toon'
import { useGame } from '../systems/store'
import { useKitModel } from '../systems/kit'

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
  const shellMesh = useRef<THREE.InstancedMesh>(null!)
  const shells = useRef<{ pos: THREE.Vector3; vel: THREE.Vector3; t: number }[]>([])
  const shellTimer = useRef(TANKS.shellInterval)
  const lastSpawnDist = useRef(0)
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
    if (im.position.z >= TANKS.fromZ && aliveTanks.length < TANKS.max && Math.random() < dt * 0.4) {
      const d = TANKS.aheadMin + Math.random() * (TANKS.aheadMax - TANKS.aheadMin)
      const side = (Math.random() < 0.5 ? -1 : 1) * TANKS.side
      const px = im.position.x + fx * d + Math.cos(yaw) * side
      const pz = im.position.z + fz * d - Math.sin(yaw) * side
      const dead = tanks.current.find((e) => !e.alive)
      if (dead) {
        dead.pos.set(px, 3.5, pz)
        dead.alive = true
      } else tanks.current.push(addEnemy('tank', new THREE.Vector3(px, 3.5, pz)))
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
      shells.current.push({ pos: t.pos.clone().setY(8), vel, t: 0 })
    }
    for (let i = shells.current.length - 1; i >= 0; i--) {
      const s = shells.current[i]
      s.t += dt
      s.pos.addScaledVector(s.vel, dt)
      const hit = Math.hypot(s.pos.x - im.position.x, s.pos.z - im.position.z) < HIT.radius * 0.5 && s.pos.y > 0 && s.pos.y < 60
      if (hit) emit('imouto.hit', { x: s.pos.x, y: s.pos.y, z: s.pos.z })
      if (hit || s.t > 8 || s.pos.y < 0) shells.current.splice(i, 1)
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
          g.position.set(e.pos.x, 0, e.pos.z)
          g.rotation.y = snapToRoad(e.pos.x, e.pos.z).alongX ? Math.PI / 2 : 0
        }
      })
    } else {
      write(policeMesh.current, police.current, POLICE.size.h / 2, (e) => (snapToRoad(e.pos.x, e.pos.z).alongX ? Math.PI / 2 : 0))
      write(lightMesh.current, police.current, POLICE.size.h + 0.6)
    }
    if (tankKit) {
      tankMesh.current.count = 0
      const alive = tanks.current.filter((e) => e.alive)
      tankGroups.current.forEach((g, i) => {
        const e = alive[i]
        g.visible = !!e
        if (e) {
          g.position.set(e.pos.x, 0, e.pos.z)
          g.rotation.y = yaw + Math.PI
        }
      })
    } else {
      write(tankMesh.current, tanks.current, TANKS.size.h / 2, () => yaw + Math.PI)
    }
    shellMesh.current.count = shells.current.length
    shells.current.forEach((s, i) => {
      m4.identity()
      m4.setPosition(s.pos)
      shellMesh.current.setMatrixAt(i, m4)
    })
    shellMesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
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
      <instancedMesh ref={shellMesh} args={[undefined, undefined, 32]}>
        <sphereGeometry args={[1.4, 8, 8]} />
        <meshBasicMaterial color="#ffd166" />
      </instancedMesh>
    </group>
  )
}
