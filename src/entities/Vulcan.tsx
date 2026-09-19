import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BRO, DUMMY_ENEMIES } from '../config/game'
import { enemies, killEnemy } from '../systems/enemies'
import { projectiles } from '../systems/projectiles'
import { refs } from '../systems/refs'
import { emit } from '../systems/events'
import { useGame } from '../systems/store'

interface Bullet {
  pos: THREE.Vector3
  prev: THREE.Vector3
  vel: THREE.Vector3
  t: number
}
interface Spark {
  pos: THREE.Vector3
  t: number
}

const MAX = 96
const SPARK_MAX = 24
const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()
const s3 = new THREE.Vector3()
const dir = new THREE.Vector3()
const muzzle = new THREE.Vector3()
const ndc = new THREE.Vector3()
const seg = new THREE.Vector3()
const toE = new THREE.Vector3()
const up = new THREE.Vector3(0, 1, 0)

/**
 * 地上のバルカン：兄がサイトの方向へ自動で連射する（BRO.vulcan）。
 * サイトが敵を捉えていれば（refs.aimTarget）その敵へ吸い付く。弾は速く、空中の敵にも当たる。hitsToKill 発で倒す。
 * 曳光弾は InstancedMesh（細長い箱）、着弾は小さな火花。
 */
export function Vulcan() {
  const { camera } = useThree()
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const sparkMesh = useRef<THREE.InstancedMesh>(null!)
  const bullets = useRef<Bullet[]>([])
  const sparks = useRef<Spark[]>([])
  const timer = useRef(0)
  const shotInBurst = useRef(0)
  /** 敵ごとの被弾数（倒れるかリスポーンでリセット） */
  const hits = useRef(new Map<number, number>())
  const vc = BRO.vulcan

  useEffect(() => {
    hits.current.clear()
    // デバッグ用（Playwright から弾数を見る）
    ;(window as unknown as { __vulcan: unknown }).__vulcan = { bullets: bullets.current, hits: hits.current, dbg }
  }, [])
  const dbg = useRef({ spawned: 0, lastDir: [0, 0, 0] as number[] }).current

  useFrame((_, dt) => {
    const st = useGame.getState()
    const bro = refs.bro
    const firing = !!bro && st.mode === 'ground' && st.phase === 'play' && !refs.broDash
    timer.current -= dt
    if (firing && bro) {
      const targetEnemy = refs.aimTarget >= 0 ? enemies.find((e) => e.id === refs.aimTarget && e.alive) : undefined
      const targetProj = refs.aimProjectile >= 0 ? projectiles[refs.aimProjectile] : undefined
      // 敵の弾がサイトに入っていればそちらを優先（撃ち落とす）
      const target = targetProj && !targetProj.dead ? targetProj : targetEnemy
      const canFire = vc.fireAlways || !!target
      while (canFire && timer.current <= 0) {
        // 3 発ずつのリズム：burst 発撃ったら burstGap だけ間を空ける
        shotInBurst.current++
        if (shotInBurst.current >= vc.burst) {
          shotInBurst.current = 0
          timer.current += vc.burstGap
        } else {
          timer.current += vc.interval
        }
        muzzle.copy(bro.position)
        muzzle.y += vc.muzzleHeight
        if (target) {
          dir.subVectors(target.pos, muzzle).normalize()
        } else {
          // サイトの画面位置からカメラのレイを引き、その先へ向けて撃つ
          const w = window.innerWidth
          const h = window.innerHeight
          ndc.set(((w / 2 + refs.reticleX) / w) * 2 - 1, -(((h / 2 + refs.reticleY) / h) * 2 - 1), 0.5).unproject(camera)
          ndc.sub(camera.position).normalize()
          // レイ上の遠い点を狙う（銃口はカメラと少しずれている）
          ndc.multiplyScalar(600).add(camera.position)
          dir.subVectors(ndc, muzzle).normalize()
        }
        // ばらつき
        dir.x += (Math.random() - 0.5) * vc.spread * 2
        dir.y += (Math.random() - 0.5) * vc.spread * 2
        dir.z += (Math.random() - 0.5) * vc.spread * 2
        dir.normalize()
        const b: Bullet = { pos: muzzle.clone(), prev: muzzle.clone(), vel: dir.clone().multiplyScalar(vc.speed), t: 0 }
        bullets.current.push(b)
        if (bullets.current.length > MAX) bullets.current.shift()
        dbg.spawned++
        dbg.lastDir = [dir.x, dir.y, dir.z]
        emit('vulcan.shot', undefined)
      }
    } else {
      timer.current = Math.max(0, timer.current)
    }
    // 弾の移動と当たり判定（前フレーム位置→今の位置の線分と敵の距離）
    const list = bullets.current
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i]
      b.t += dt
      b.prev.copy(b.pos)
      b.pos.addScaledVector(b.vel, dt)
      // 当たり判定を先に（フレームが長い環境でも寿命切れより命中を優先）
      let dead = false
      {
        seg.subVectors(b.pos, b.prev)
        const segLen2 = seg.lengthSq()
        // 敵の弾（爆弾・ミサイル・砲弾）：当たれば撃ち落とす
        for (const p of projectiles) {
          if (p.dead) continue
          toE.subVectors(p.pos, b.prev)
          const u = segLen2 > 0 ? THREE.MathUtils.clamp(toE.dot(seg) / segLen2, 0, 1) : 0
          const dx = b.prev.x + seg.x * u - p.pos.x
          const dy = b.prev.y + seg.y * u - p.pos.y
          const dz = b.prev.z + seg.z * u - p.pos.z
          const r = vc.hitRadius + p.radius
          if (dx * dx + dy * dy + dz * dz > r * r) continue
          dead = true
          p.dead = true
          emit('bomb.burst', { x: p.pos.x, y: p.pos.y, z: p.pos.z })
          st.addScore(vc.projectileScore)
          break
        }
        for (const e of enemies) {
          if (dead) break
          if (!e.alive) continue
          toE.subVectors(e.pos, b.prev)
          const u = segLen2 > 0 ? THREE.MathUtils.clamp(toE.dot(seg) / segLen2, 0, 1) : 0
          const dx = b.prev.x + seg.x * u - e.pos.x
          const dy = b.prev.y + seg.y * u - e.pos.y
          const dz = b.prev.z + seg.z * u - e.pos.z
          if (dx * dx + dy * dy + dz * dz > vc.hitRadius * vc.hitRadius) continue
          // 命中
          dead = true
          const n = (hits.current.get(e.id) ?? 0) + 1
          sparks.current.push({ pos: e.pos.clone(), t: 0 })
          if (sparks.current.length > SPARK_MAX) sparks.current.shift()
          if (n >= (e.kind === 'boss' ? vc.bossHitsToKill : vc.hitsToKill)) {
            hits.current.delete(e.id)
            killEnemy(e.id, e.kind === 'dummy' ? DUMMY_ENEMIES.respawnSec : 0)
            dir.copy(b.vel).normalize()
            emit('enemy.hit', { id: e.id, x: e.pos.x, y: e.pos.y, z: e.pos.z, dir: [dir.x, Math.max(0.4, dir.y), dir.z] })
            st.addScore(vc.killScore)
          } else {
            hits.current.set(e.id, n)
            emit('vulcan.hit', { x: e.pos.x, y: e.pos.y, z: e.pos.z })
            st.addScore(vc.hitScore)
          }
          break
        }
      }
      if (b.t > vc.lifeSec || b.pos.y < 0) dead = true
      if (dead) list.splice(i, 1)
    }
    // 描画：曳光弾（進行方向に向けた細長い箱）
    const m = mesh.current
    m.count = list.length
    list.forEach((b, i) => {
      dir.copy(b.vel).normalize()
      q.setFromUnitVectors(up, dir)
      s3.set(vc.tracerWidth, vc.tracerLen, vc.tracerWidth)
      m4.compose(b.pos, q, s3)
      m.setMatrixAt(i, m4)
    })
    m.instanceMatrix.needsUpdate = true
    // 火花：膨らんで消える
    const sp = sparks.current
    for (let i = sp.length - 1; i >= 0; i--) {
      sp[i].t += dt
      if (sp[i].t > vc.sparkSec) sp.splice(i, 1)
    }
    const sm = sparkMesh.current
    sm.count = sp.length
    sp.forEach((s, i) => {
      const k = s.t / vc.sparkSec
      s3.setScalar(vc.sparkSize * (0.3 + 0.7 * k) + 0.001)
      m4.compose(s.pos, q.identity(), s3)
      sm.setMatrixAt(i, m4)
    })
    sm.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, MAX]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={vc.color} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={sparkMesh} args={[undefined, undefined, SPARK_MAX]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#fff3b0" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
    </group>
  )
}
