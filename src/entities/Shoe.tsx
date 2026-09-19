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
  /** 次の火柱を立てる距離 */
  nextPillar: number
}
interface Pillar {
  pos: THREE.Vector3
  t: number
}

const PILLAR_MAX = 64
const dirTmp = new THREE.Vector3()

/**
 * 靴飛ばし：前方直線に飛ぶ靴。通り道の敵と建物を壊し、当たったものは通常の power 倍の高さへ吹っ飛ぶ。
 * 靴の後ろには地面から大きな火柱が続く（SKILLS.shoe.pillar）
 */
export function Shoe() {
  const list = useRef<Flying[]>([])
  const pillars = useRef<Pillar[]>([])
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const pillarMesh = useRef<THREE.InstancedMesh>(null!)
  const pillarCore = useRef<THREE.InstancedMesh>(null!)
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const s3 = useMemo(() => new THREE.Vector3(), [])
  const axisX = useMemo(() => new THREE.Vector3(1, 0, 0), [])
  // 火柱の形：底が地面になるように、円柱を上へ半分ずらしておく
  const pillarGeom = useMemo(() => new THREE.CylinderGeometry(0.55, 1, 1, 12, 1, true).translate(0, 0.5, 0), [])
  const coreGeom = useMemo(() => new THREE.CylinderGeometry(0.25, 0.6, 1, 10, 1, true).translate(0, 0.5, 0), [])

  useEffect(() => {
    // デバッグ用（Playwright から靴と火柱の数を見る）
    ;(window as unknown as { __shoe: unknown }).__shoe = { list: list.current, pillars: pillars.current }
  }, [])
  useEffect(
    () =>
      on('shoe.launch', ({ x, y, z, yaw }) => {
        list.current.push({ pos: new THREE.Vector3(x, y, z), dir: new THREE.Vector3(Math.sin(yaw), 0.05, Math.cos(yaw)).normalize(), dist: 0, hits: 0, nextPillar: 0 })
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
      // 火柱：一定距離ごとに靴の真下（地面）に立てる
      while (f.dist >= f.nextPillar) {
        pillars.current.push({ pos: new THREE.Vector3(f.pos.x, 0, f.pos.z), t: 0 })
        if (pillars.current.length > PILLAR_MAX) pillars.current.shift()
        f.nextPillar += cfg.pillar.every
      }
      // 建物：通り道を砕く（破片は power 倍の高さへ）
      emit('building.hitAt', { x: f.pos.x, z: f.pos.z, r: cfg.breakRadius, power: cfg.power })
      for (const e of enemies) {
        if (!e.alive) continue
        const dx = e.pos.x - f.pos.x
        const dz = e.pos.z - f.pos.z
        const dy = e.pos.y - f.pos.y
        if (Math.hypot(dx, dz) < cfg.width && Math.abs(dy) < 60) {
          killEnemy(e.id)
          dirTmp.copy(f.dir).normalize()
          emit('enemy.hit', { id: e.id, x: e.pos.x, y: e.pos.y, z: e.pos.z, dir: [dirTmp.x, 0.6, dirTmp.z], power: cfg.power })
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
      q.setFromAxisAngle(axisX, f.dist * 0.05)
      m4.makeRotationFromQuaternion(q)
      m4.setPosition(f.pos)
      mesh.current.setMatrixAt(i, m4)
    })
    mesh.current.instanceMatrix.needsUpdate = true
    // 火柱：立ち上がって（高さが伸びて）薄れながら消える
    const pc = cfg.pillar
    for (let i = pillars.current.length - 1; i >= 0; i--) {
      pillars.current[i].t += dt
      if (pillars.current[i].t > pc.lifeSec) pillars.current.splice(i, 1)
    }
    const pm = pillarMesh.current
    const cm = pillarCore.current
    pm.count = pillars.current.length
    cm.count = pillars.current.length
    pillars.current.forEach((p, i) => {
      const k = p.t / pc.lifeSec
      const rise = Math.min(1, k / 0.25) // 最初の 1/4 で伸び切る
      const h = pc.height * (0.2 + 0.8 * rise) * (1 + 0.15 * Math.sin(p.t * 30 + i))
      const r = pc.radius * (0.6 + 0.6 * Math.sqrt(k))
      s3.set(r, h, r)
      m4.compose(p.pos, q.identity(), s3)
      pm.setMatrixAt(i, m4)
      s3.set(r * 0.6, h * 0.8, r * 0.6)
      m4.compose(p.pos, q, s3)
      cm.setMatrixAt(i, m4)
    })
    pm.instanceMatrix.needsUpdate = true
    cm.instanceMatrix.needsUpdate = true
    // 全体の濃さは時間で下げる代わりに数を絞る（個別の不透明度は持てないので、色は固定）
  })

  const s = SKILLS.shoe.size
  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, 4]} castShadow>
        <boxGeometry args={[s * 0.5, s * 0.35, s]} />
        <meshToonMaterial color="#2b3f9e" gradientMap={toonGradient()} />
      </instancedMesh>
      <instancedMesh ref={pillarMesh} args={[pillarGeom, undefined, PILLAR_MAX]} frustumCulled={false} userData={{ noXray: true }}>
        <meshBasicMaterial color={SKILLS.shoe.pillar.color} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={pillarCore} args={[coreGeom, undefined, PILLAR_MAX]} frustumCulled={false} userData={{ noXray: true }}>
        <meshBasicMaterial color={SKILLS.shoe.pillar.coreColor} transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  )
}
