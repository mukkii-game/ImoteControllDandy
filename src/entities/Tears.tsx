import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TEARS } from '../config/game'
import { enemies, killEnemy } from '../systems/enemies'
import { refs } from '../systems/refs'
import { emit, on } from '../systems/events'
import { useGame } from '../systems/store'
import { DUMMY_ENEMIES } from '../config/game'

interface Drop {
  pos: THREE.Vector3
  vel: THREE.Vector3
  t: number
}

const MAX = 200
const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()
const s3 = new THREE.Vector3()
const up = new THREE.Vector3(0, 1, 0)
const dir = new THREE.Vector3()
const eye = new THREE.Vector3()
const prev = new THREE.Vector3()
const seg = new THREE.Vector3()
const toE = new THREE.Vector3()

/**
 * 「泣け」の涙の玉（TEARS）。技の発動で妹の目から四方へ一度に大量に飛び散り、当たった敵は一撃。
 * 玉は縦長の水色の球（InstancedMesh）。放物線で落ちて寿命で消える
 */
export function Tears() {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const drops = useRef<Drop[]>([])

  useEffect(
    () =>
      on('imouto.skill', ({ id }) => {
        if (id !== 'cry') return
        const im = refs.imouto
        if (!im) return
        // 目の位置：頭ボーンの少し前・上
        if (refs.head) refs.head.getWorldPosition(eye)
        else eye.copy(im.position).setY(im.position.y + 55)
        const yaw = im.rotation.y
        eye.x += Math.sin(yaw) * TEARS.eyeForward
        eye.z += Math.cos(yaw) * TEARS.eyeForward
        eye.y += TEARS.eyeUp
        for (let i = 0; i < TEARS.count; i++) {
          const a = Math.random() * Math.PI * 2
          const y = THREE.MathUtils.lerp(TEARS.yMin, TEARS.yMax, Math.random())
          const h = Math.sqrt(Math.max(0, 1 - y * y))
          dir.set(Math.cos(a) * h, y, Math.sin(a) * h)
          const sp = TEARS.speed * (1 - TEARS.speedVar * Math.random())
          drops.current.push({ pos: eye.clone(), vel: dir.clone().multiplyScalar(sp), t: 0 })
        }
        while (drops.current.length > MAX) drops.current.shift()
      }),
    [],
  )

  useFrame((_, dt) => {
    const st = useGame.getState()
    const list = drops.current
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i]
      d.t += dt
      d.vel.y -= TEARS.gravity * dt
      prev.copy(d.pos)
      d.pos.addScaledVector(d.vel, dt)
      let dead = d.t > TEARS.lifeSec || d.pos.y < 0
      if (!dead) {
        // 前フレームの位置→今の位置の線分で判定（フレームが長くてもすり抜けない）
        seg.subVectors(d.pos, prev)
        const segLen2 = seg.lengthSq()
        for (const e of enemies) {
          if (!e.alive) continue
          toE.subVectors(e.pos, prev)
          const u = segLen2 > 0 ? THREE.MathUtils.clamp(toE.dot(seg) / segLen2, 0, 1) : 0
          const dx = prev.x + seg.x * u - e.pos.x
          const dy = prev.y + seg.y * u - e.pos.y
          const dz = prev.z + seg.z * u - e.pos.z
          if (dx * dx + dy * dy + dz * dz > TEARS.hitRadius * TEARS.hitRadius) continue
          dead = true
          killEnemy(e.id, e.kind === 'dummy' ? DUMMY_ENEMIES.respawnSec : 0)
          dir.copy(d.vel).normalize()
          emit('enemy.hit', { id: e.id, x: e.pos.x, y: e.pos.y, z: e.pos.z, dir: [dir.x, Math.max(0.4, dir.y), dir.z] })
          st.addScore(TEARS.score)
          break
        }
      }
      if (dead) list.splice(i, 1)
    }
    const m = mesh.current
    m.count = list.length
    list.forEach((d, i) => {
      // 進行方向に少し伸ばした雫
      dir.copy(d.vel).normalize()
      q.setFromUnitVectors(up, dir)
      s3.set(TEARS.size, TEARS.size * TEARS.stretch, TEARS.size)
      m4.compose(d.pos, q, s3)
      m.setMatrixAt(i, m4)
    })
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX]} frustumCulled={false}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshBasicMaterial color={TEARS.color} transparent opacity={0.9} />
    </instancedMesh>
  )
}
