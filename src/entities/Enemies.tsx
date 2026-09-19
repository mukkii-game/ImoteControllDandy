import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DUMMY_ENEMIES, LOCKON, DEBRIS } from '../config/game'
import { HIT } from '../config/waves'
import { addEnemy, enemies } from '../systems/enemies'
import { refs } from '../systems/refs'
import { on } from '../systems/events'

const tmpColor = new THREE.Color()
const PUFF_MAX = 96
const SMOKE_FIRE = new THREE.Color('#ff8a3a')
const SMOKE_DARK = new THREE.Color('#2a2a2a')
const SMOKE_LIGHT = new THREE.Color('#b0b0b0')

/**
 * テスト用の的：妹の周りを周回する球。ステップ4で戦闘機に置き換える。
 * 破壊されると数秒で再出現。
 */
export function DummyEnemies() {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const seeds = useMemo(() => Array.from({ length: DUMMY_ENEMIES.count }, (_, i) => i / DUMMY_ENEMIES.count), [])
  const m4 = useMemo(() => new THREE.Matrix4(), [])

  useEffect(() => {
    const created = seeds.map(() => addEnemy('dummy', new THREE.Vector3()))
    return () => {
      for (const e of created) {
        const i = enemies.indexOf(e)
        if (i >= 0) enemies.splice(i, 1)
      }
    }
  }, [seeds])

  useFrame(({ clock }, dt) => {
    const im = refs.imouto
    if (!im) return
    const t = clock.elapsedTime
    const list = enemies.filter((e) => e.kind === 'dummy')
    list.forEach((e, i) => {
      const s = seeds[i] ?? 0
      const a = t * DUMMY_ENEMIES.orbitSpeed * (i % 2 ? 1 : -1) + s * Math.PI * 2
      const r = DUMMY_ENEMIES.orbitRadius * (0.7 + 0.3 * Math.sin(s * 7))
      const h = THREE.MathUtils.lerp(DUMMY_ENEMIES.heightMin, DUMMY_ENEMIES.heightMax, (Math.sin(s * 13 + t * 0.3) + 1) / 2)
      e.pos.set(im.position.x + Math.cos(a) * r, h, im.position.z + Math.sin(a) * r)
      if (!e.alive) {
        e.respawn -= dt
        if (e.respawn <= 0) e.alive = true
      }
      m4.makeScale(e.alive ? 1 : 0.0001, e.alive ? 1 : 0.0001, e.alive ? 1 : 0.0001)
      m4.setPosition(e.pos)
      mesh.current.setMatrixAt(i, m4)
      mesh.current.setColorAt(i, tmpColor.setHSL((s * 0.9 + 0.05) % 1, 0.8, 0.55))
    })
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, DUMMY_ENEMIES.count]} castShadow>
      <sphereGeometry args={[DUMMY_ENEMIES.size, 12, 10]} />
      <meshStandardMaterial roughness={0.4} />
    </instancedMesh>
  )
}

interface Boom {
  pos: THREE.Vector3
  t: number
  /** 砂煙（足元のリングだけ） */
  dust: boolean
  /** 砂煙の大きさ倍率 */
  scale?: number
  /** 爆発の半径（m）。無ければ LOCKON.explosionRadius */
  radius?: number
}

interface Puff {
  pos: THREE.Vector3
  vel: THREE.Vector3
  t: number
  size: number
}

/** 着弾の爆発（膨らむ球＋リング）、黒煙、砂煙。イベント駆動 */
export function Explosions() {
  const list = useRef<Boom[]>([])
  const puffs = useRef<Puff[]>([])
  const puffMesh = useRef<THREE.InstancedMesh>(null!)
  const puffM4 = useMemo(() => new THREE.Matrix4(), [])
  const puffColor = useMemo(() => new THREE.Color(), [])
  const group = useRef<THREE.Group>(null!)
  const pool = useMemo(
    () =>
      Array.from({ length: 14 }, () => {
        const g = new THREE.Group()
        const core = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff1a8', transparent: true }))
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 8, 32), new THREE.MeshBasicMaterial({ color: '#ff7a2a', transparent: true, depthWrite: false }))
        ring.rotation.x = Math.PI / 2
        g.add(core, ring)
        g.visible = false
        return g
      }),
    [],
  )

  useEffect(() => {
    pool.forEach((g) => group.current.add(g))
    const off1 = on('enemy.hit', ({ id, x, y, z }) => {
      if (id < 0) return // 建物は building.crush / building.break 側で砂煙
      list.current.push({ pos: new THREE.Vector3(x, y, z), t: 0, dust: false })
      if (list.current.length > pool.length) list.current.shift()
      // 黒煙：ばらけて立ち上る
      const s = DEBRIS.smoke
      for (let i = 0; i < s.n; i++) {
        puffs.current.push({
          pos: new THREE.Vector3(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 4, z + (Math.random() - 0.5) * 6),
          vel: new THREE.Vector3((Math.random() - 0.5) * 8, s.rise * (0.6 + Math.random() * 0.8), (Math.random() - 0.5) * 8),
          t: -i * 0.05,
          size: s.size * (0.7 + Math.random() * 0.6),
        })
      }
      while (puffs.current.length > PUFF_MAX) puffs.current.shift()
    })
    const pushDust = (x: number, z: number, scale: number) => {
      list.current.push({ pos: new THREE.Vector3(x, 1, z), t: 0, dust: true, scale })
      if (list.current.length > pool.length) list.current.shift()
    }
    const off4 = on('building.crush', ({ x, z, w }) => pushDust(x, z, Math.max(0.5, w / DEBRIS.dustSize)))
    const off5 = on('building.break', ({ x, z, w }) => pushDust(x, z, Math.max(0.8, (w * 1.5) / DEBRIS.dustSize)))
    const off6 = on('bomb.burst', ({ x, y, z }) => {
      list.current.push({ pos: new THREE.Vector3(x, y, z), t: 0, dust: false })
      if (list.current.length > pool.length) list.current.shift()
      pushDust(x, z, 1)
    })
    const off3 = on('imouto.hit', ({ x, y, z }) => {
      // 妹の体への着弾：兄と同じくらいの小さな爆発（着弾点は体の表面）＋火の玉から黒煙になる粒
      list.current.push({ pos: new THREE.Vector3(x, y, z), t: 0, dust: false, radius: HIT.explosionRadius })
      for (let i = 0; i < HIT.puffs; i++) {
        puffs.current.push({
          pos: new THREE.Vector3(x + (Math.random() - 0.5) * 2, y + (Math.random() - 0.5) * 2, z + (Math.random() - 0.5) * 2),
          vel: new THREE.Vector3((Math.random() - 0.5) * 14, 4 + Math.random() * 10, (Math.random() - 0.5) * 14),
          t: -i * 0.03,
          size: HIT.puffSize * (0.7 + Math.random() * 0.6),
        })
      }
      while (puffs.current.length > PUFF_MAX) puffs.current.shift()
      if (list.current.length > pool.length) list.current.shift()
    })
    const off2 = on('imouto.step', ({ x, z, strength }) => {
      if (strength < 0.3) return
      list.current.push({ pos: new THREE.Vector3(x, 1, z), t: 0, dust: true })
      if (list.current.length > pool.length) list.current.shift()
    })
    return () => {
      off1()
      off2()
      off3()
      off4()
      off5()
      off6()
    }
  }, [pool])

  useFrame((_, dt) => {
    // 黒煙：上がりながら膨らんで薄くなる
    const s = DEBRIS.smoke
    puffs.current = puffs.current.filter((p) => (p.t += dt) < s.sec)
    const pm = puffMesh.current
    pm.count = puffs.current.length
    puffs.current.forEach((p, i) => {
      if (p.t < 0) {
        puffM4.makeScale(0.0001, 0.0001, 0.0001)
        pm.setMatrixAt(i, puffM4)
        return
      }
      p.pos.addScaledVector(p.vel, dt)
      p.vel.multiplyScalar(1 - 0.8 * dt)
      const k = p.t / s.sec
      const r = p.size * (0.4 + 1.2 * k)
      puffM4.makeScale(r, r, r)
      puffM4.setPosition(p.pos)
      pm.setMatrixAt(i, puffM4)
      // 最初は明るいオレンジ寄り、すぐ黒煙、最後は薄い灰色に
      pm.setColorAt(i, k < 0.15 ? puffColor.copy(SMOKE_FIRE).lerp(SMOKE_DARK, k / 0.15) : puffColor.copy(SMOKE_DARK).lerp(SMOKE_LIGHT, (k - 0.15) / 0.85))
    })
    pm.instanceMatrix.needsUpdate = true
    if (pm.instanceColor) pm.instanceColor.needsUpdate = true
    ;(pm.material as THREE.MeshBasicMaterial).opacity = 0.75

    pool.forEach((g) => (g.visible = false))
    list.current = list.current.filter((b) => (b.t += dt) < LOCKON.explosionSec)
    list.current.forEach((b, i) => {
      const g = pool[i]
      const k = b.t / LOCKON.explosionSec
      g.visible = true
      g.position.copy(b.pos)
      const core = g.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
      const ring = g.children[1] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
      if (b.dust) {
        core.visible = false
        ring.visible = true
        ring.scale.setScalar((20 + 40 * Math.sqrt(k)) * (b.scale ?? 1))
        ring.material.color.set('#d9c8a0')
        ring.material.opacity = 0.7 * (1 - k)
      } else {
        core.visible = true
        ring.visible = true
        ring.material.color.set('#ff7a2a')
        const r = (b.radius ?? LOCKON.explosionRadius) * (0.3 + 0.7 * Math.sqrt(k))
        core.scale.setScalar(r * (1 - k * 0.3))
        ring.scale.setScalar(r * 1.6)
        core.material.opacity = 1 - k
        ring.material.opacity = 0.8 * (1 - k)
      }
    })
  })

  return (
    <group>
      <group ref={group} />
      <instancedMesh ref={puffMesh} args={[undefined, undefined, PUFF_MAX]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial transparent depthWrite={false} />
      </instancedMesh>
    </group>
  )
}
