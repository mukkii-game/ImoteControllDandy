import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SKILLS } from '../config/skills'
import { enemies, killEnemy } from '../systems/enemies'
import { emit, on } from '../systems/events'
import { useGame } from '../systems/store'
import { toonGradient } from '../systems/toon'

interface Flying {
  pos: THREE.Vector3
  dir: THREE.Vector3
  dist: number
  hits: number
}

/** 靴飛ばし：前方直線に飛ぶ靴。通り道の敵を倒す */
export function Shoe() {
  const list = useRef<Flying[]>([])
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])

  useEffect(
    () =>
      on('shoe.launch', ({ x, y, z, yaw }) => {
        list.current.push({ pos: new THREE.Vector3(x, y, z), dir: new THREE.Vector3(Math.sin(yaw), 0.05, Math.cos(yaw)).normalize(), dist: 0, hits: 0 })
      }),
    [],
  )

  useFrame((_, dt) => {
    const cfg = SKILLS.shoe
    for (let i = list.current.length - 1; i >= 0; i--) {
      const f = list.current[i]
      const step = cfg.speed * dt
      f.pos.addScaledVector(f.dir, step)
      f.dist += step
      for (const e of enemies) {
        if (!e.alive) continue
        const dx = e.pos.x - f.pos.x
        const dz = e.pos.z - f.pos.z
        const dy = e.pos.y - f.pos.y
        if (Math.hypot(dx, dz) < cfg.width && Math.abs(dy) < 60) {
          killEnemy(e.id)
          emit('enemy.hit', { id: e.id, x: e.pos.x, y: e.pos.y, z: e.pos.z })
          f.hits++
        }
      }
      if (f.dist > cfg.range) {
        if (f.hits > 0) {
          const st = useGame.getState()
          st.addScore(120 * f.hits * (f.hits > 1 ? f.hits : 1))
          if (f.hits > 1) st.setCombo(f.hits)
        }
        list.current.splice(i, 1)
      }
    }
    mesh.current.count = list.current.length
    list.current.forEach((f, i) => {
      q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), f.dist * 0.05)
      m4.makeRotationFromQuaternion(q)
      m4.setPosition(f.pos)
      mesh.current.setMatrixAt(i, m4)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  const s = SKILLS.shoe.size
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 4]} castShadow>
      <boxGeometry args={[s * 0.5, s * 0.35, s]} />
      <meshToonMaterial color="#2b3f9e" gradientMap={toonGradient()} />
    </instancedMesh>
  )
}
