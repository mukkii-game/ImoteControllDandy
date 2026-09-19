import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GAME, DEBRIS } from '../config/game'
import { on } from '../systems/events'
import { getEnemy } from '../systems/enemies'
import { toonGradient } from '../systems/toon'

interface Piece {
  pos: THREE.Vector3
  vel: THREE.Vector3
  rot: THREE.Euler
  rotV: THREE.Vector3
  size: THREE.Vector3
  color: THREE.Color
  t: number
  life: number
  /** 重力の倍率（空中の敵の破片はゆっくり落ちる） */
  g: number
}

const MAX_BOX = 320
const MAX_ROOF = 40
const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()
const s3 = new THREE.Vector3()
const rnd = (a: number) => (Math.random() - 0.5) * 2 * a

/**
 * 破片・部品。物理エンジン無しの簡易放物運動（地面で弾んで止まる）。
 * - 高いビルが砕ける：ブロック破片
 * - 家が潰れる：屋根（四角錐）が丸ごと飛び、壁の破片が散る
 * - 敵がやられる：種類ごとの部品（車体・タイヤ・翼など）が飛び散る（DEBRIS.parts）
 */
export function Debris() {
  const boxMesh = useRef<THREE.InstancedMesh>(null!)
  const roofMesh = useRef<THREE.InstancedMesh>(null!)
  const boxes = useRef<Piece[]>([])
  const roofs = useRef<Piece[]>([])
  const grad = useMemo(() => toonGradient(), [])

  useEffect(() => {
    const push = (list: Piece[], max: number, p: Piece) => {
      list.push(p)
      while (list.length > max) list.shift()
    }
    const piece = (pos: THREE.Vector3, vel: THREE.Vector3, size: THREE.Vector3, color: string, life = GAME.debrisSec, spin = 4): Piece => ({
      pos,
      vel,
      rot: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
      rotV: new THREE.Vector3(rnd(spin), rnd(spin), rnd(spin)),
      size,
      color: new THREE.Color(color),
      t: 0,
      life,
      g: 1,
    })
    const offBreak = on('building.break', ({ x, z, w, h, d, color }) => {
      const n = GAME.debrisPerBuilding
      const cols = 2
      const rows = Math.max(2, Math.round(n / 2))
      for (let i = 0; i < n; i++) {
        const cx = x + ((i % cols) - 0.5) * (w / 2)
        const cy = (Math.floor(i / cols) + 0.5) * (h / rows)
        const cz = z + rnd(d * 0.25)
        push(boxes.current, MAX_BOX, piece(new THREE.Vector3(cx, cy, cz), new THREE.Vector3(rnd(15), 8 + Math.random() * 18, rnd(15)), new THREE.Vector3(w / cols, h / rows, d * 0.6), color))
      }
    })
    const offCrush = on('building.crush', ({ x, z, w, h, d, color, roofColor }) => {
      const c = DEBRIS.house
      // 屋根：丸ごと飛び上がって回転しながら落ちる
      if (roofColor) {
        const r = piece(new THREE.Vector3(x, h + w * 0.22, z), new THREE.Vector3(rnd(c.spread * 0.5), c.roofUp, rnd(c.spread * 0.5)), new THREE.Vector3(w * 0.78, w * 0.45, d * 0.78), roofColor, GAME.debrisSec + 1, 3)
        r.rot.set(0, Math.PI / 4, 0)
        push(roofs.current, MAX_ROOF, r)
      }
      // 壁：四方へ散る
      for (let i = 0; i < c.wallPieces; i++) {
        const a = (i / c.wallPieces) * Math.PI * 2
        const vel = new THREE.Vector3(Math.cos(a) * c.spread * (0.6 + Math.random() * 0.6), 6 + Math.random() * 10, Math.sin(a) * c.spread * (0.6 + Math.random() * 0.6))
        const size = new THREE.Vector3(w * (0.2 + Math.random() * 0.2), h * (0.3 + Math.random() * 0.4), d * 0.15)
        push(boxes.current, MAX_BOX, piece(new THREE.Vector3(x + Math.cos(a) * w * 0.4, h * 0.5, z + Math.sin(a) * d * 0.4), vel, size, color))
      }
    })
    const offHit = on('enemy.hit', ({ id, x, y, z, dir }) => {
      if (id < 0) return
      const kind = getEnemy(id)?.kind ?? 'dummy'
      const parts = DEBRIS.parts[kind] ?? DEBRIS.parts.dummy
      const b = DEBRIS.burst
      const air = DEBRIS.air.kinds.includes(kind)
      // 兄の攻撃（地上の敵）：本体が食らった方向へノックバックして上へも派手に吹っ飛ぶ
      const body = dir && !air && DEBRIS.knockback.body[kind]
      if (body && dir) {
        const kb = DEBRIS.knockback
        const vel = new THREE.Vector3(dir[0] * kb.speed, kb.up + Math.max(0, dir[1]) * kb.speed, dir[2] * kb.speed)
        push(boxes.current, MAX_BOX, piece(new THREE.Vector3(x, Math.max(2, y), z), vel, new THREE.Vector3(...body.size), body.color, GAME.debrisSec + 1, 7))
      }
      // 空中の敵：その場で爆発して離散、半分の重力でパラパラ落ちる（やっつけた手応え）
      const spread = air ? DEBRIS.air.spread : b.spread
      const up = air ? DEBRIS.air.up : b.up
      for (const part of parts) {
        for (let i = 0; i < part.n; i++) {
          const vel = new THREE.Vector3(rnd(spread), up * (air ? rnd(1) : 0.5 + Math.random()), rnd(spread))
          const pos = new THREE.Vector3(x + rnd(2), Math.max(1, y + rnd(2)), z + rnd(2))
          const pc = piece(pos, vel, new THREE.Vector3(...part.size), part.color, air ? DEBRIS.air.lifeSec : GAME.debrisSec, 8)
          if (air) pc.g = DEBRIS.air.gravityScale
          push(boxes.current, MAX_BOX, pc)
        }
      }
    })
    return () => {
      offBreak()
      offCrush()
      offHit()
    }
  }, [])

  const step = (list: Piece[], dt: number) => {
    const g = 40
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]
      p.t += dt
      if (p.t > p.life) {
        list.splice(i, 1)
        continue
      }
      p.vel.y -= g * p.g * dt
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
  }
  const write = (m: THREE.InstancedMesh, list: Piece[]) => {
    m.count = list.length
    list.forEach((p, i) => {
      q.setFromEuler(p.rot)
      const fade = p.t > p.life - 0.6 ? (p.life - p.t) / 0.6 : 1
      m4.compose(p.pos, q, s3.copy(p.size).multiplyScalar(fade))
      m.setMatrixAt(i, m4)
      m.setColorAt(i, p.color)
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }

  useFrame((_, dt) => {
    step(boxes.current, dt)
    step(roofs.current, dt)
    write(boxMesh.current, boxes.current)
    write(roofMesh.current, roofs.current)
  })

  return (
    <group>
      <instancedMesh ref={boxMesh} args={[undefined, undefined, MAX_BOX]} castShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshToonMaterial gradientMap={grad} />
      </instancedMesh>
      <instancedMesh ref={roofMesh} args={[undefined, undefined, MAX_ROOF]} castShadow frustumCulled={false}>
        <coneGeometry args={[1, 1, 4]} />
        <meshToonMaterial gradientMap={grad} />
      </instancedMesh>
    </group>
  )
}
