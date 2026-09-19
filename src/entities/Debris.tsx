import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GAME } from '../config/game'
import { on } from '../systems/events'
import { toonGradient } from '../systems/toon'

interface Piece {
  pos: THREE.Vector3
  vel: THREE.Vector3
  rot: THREE.Euler
  rotV: THREE.Vector3
  size: THREE.Vector3
  color: THREE.Color
  t: number
}

const MAX = 240
const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()

/**
 * 建物の破片。物理エンジン無しの簡易放物運動（地面で止まる）。
 * 高い建物が砕けたとき、幅高さを分割したブロックとして飛び散る。
 */
export function Debris() {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const pieces = useRef<Piece[]>([])
  const grad = useMemo(() => toonGradient(), [])

  useEffect(
    () =>
      on('building.break', ({ x, z, w, h, d, color }) => {
        const n = GAME.debrisPerBuilding
        const cols = 2
        const rows = Math.max(2, Math.round(n / 2))
        for (let i = 0; i < n; i++) {
          const cx = x + ((i % cols) - 0.5) * (w / 2)
          const cy = (Math.floor(i / cols) + 0.5) * (h / rows)
          const cz = z + (Math.random() - 0.5) * d * 0.5
          pieces.current.push({
            pos: new THREE.Vector3(cx, cy, cz),
            vel: new THREE.Vector3((Math.random() - 0.5) * 30, 8 + Math.random() * 18, (Math.random() - 0.5) * 30),
            rot: new THREE.Euler(Math.random(), Math.random(), Math.random()),
            rotV: new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4),
            size: new THREE.Vector3(w / cols, h / rows, d * 0.6),
            color: new THREE.Color(color),
            t: 0,
          })
        }
        while (pieces.current.length > MAX) pieces.current.shift()
      }),
    [],
  )

  useFrame((_, dt) => {
    const g = 40
    for (let i = pieces.current.length - 1; i >= 0; i--) {
      const p = pieces.current[i]
      p.t += dt
      if (p.t > GAME.debrisSec) {
        pieces.current.splice(i, 1)
        continue
      }
      p.vel.y -= g * dt
      p.pos.addScaledVector(p.vel, dt)
      const floor = p.size.y / 2
      if (p.pos.y < floor) {
        p.pos.y = floor
        p.vel.y *= -0.25
        p.vel.x *= 0.7
        p.vel.z *= 0.7
        p.rotV.multiplyScalar(0.5)
      }
      p.rot.x += p.rotV.x * dt
      p.rot.y += p.rotV.y * dt
      p.rot.z += p.rotV.z * dt
    }
    const m = mesh.current
    m.count = pieces.current.length
    pieces.current.forEach((p, i) => {
      q.setFromEuler(p.rot)
      const fade = p.t > GAME.debrisSec - 0.6 ? (GAME.debrisSec - p.t) / 0.6 : 1
      m4.compose(p.pos, q, new THREE.Vector3(p.size.x * fade, p.size.y * fade, p.size.z * fade))
      m.setMatrixAt(i, m4)
      m.setColorAt(i, p.color)
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX]} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshToonMaterial gradientMap={grad} />
    </instancedMesh>
  )
}
