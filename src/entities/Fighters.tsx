import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FIGHTERS, HIT } from '../config/waves'
import { addEnemy, enemies, isStunned, type Enemy } from '../systems/enemies'
import { refs } from '../systems/refs'
import { emit, on } from '../systems/events'
import { SmokeRibbon } from '../systems/smoke'
import { toonGradient } from '../systems/toon'
import { useKitModel } from '../systems/kit'

const up = new THREE.Vector3(0, 1, 0)
const tangent = new THREE.Vector3()
const nextT = new THREE.Vector3()
const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()

/**
 * 妹ローカルの点列（x=右, z=前）。ワールドへは毎フレーム妹の位置・向きで変換するので、編隊は妹に付いて回る。
 * エネセット：gen ごとに出現方向（FIGHTERS.passes）を順番に回す。開いた道なので入ってきて抜けていく。
 */
function buildCurve(gen: number): THREE.CatmullRomCurve3 {
  const pass = FIGHTERS.passes[gen % FIGHTERS.passes.length]
  const pts = pass.path.map(([x, y, z]) => new THREE.Vector3(x, y, z))
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
}
const localP = new THREE.Vector3()
const localN = new THREE.Vector3()
function toWorld(local: THREE.Vector3, out: THREE.Vector3) {
  const im = refs.imouto
  const yaw = im?.rotation.y ?? 0
  const ox = im?.position.x ?? 0
  const oz = im?.position.z ?? 0
  out.set(ox + Math.cos(yaw) * local.x + Math.sin(yaw) * local.z, local.y, oz - Math.sin(yaw) * local.x + Math.cos(yaw) * local.z)
  return out
}

/** 機体（プリミティブ。ブルーインパルス風の白×青） */
function JetMesh() {
  const s = FIGHTERS.size
  const grad = toonGradient()
  const kit = useKitModel('jet')
  if (kit) return <primitive object={kit.scene.clone()} />
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[s * 0.09, s, 10]} />
        <meshToonMaterial color="#1f3fbf" gradientMap={grad} />
      </mesh>
      <mesh position={[0, 0, -s * 0.1]} castShadow>
        <boxGeometry args={[s * 0.8, s * 0.04, s * 0.28]} />
        <meshToonMaterial color="#f4f6ff" gradientMap={grad} />
      </mesh>
      <mesh position={[0, s * 0.09, -s * 0.4]} castShadow>
        <boxGeometry args={[s * 0.04, s * 0.2, s * 0.16]} />
        <meshToonMaterial color="#e63946" gradientMap={grad} />
      </mesh>
      <mesh position={[0, s * 0.05, s * 0.15]}>
        <sphereGeometry args={[s * 0.07, 8, 8]} />
        <meshToonMaterial color="#9ad0ff" gradientMap={grad} />
      </mesh>
    </group>
  )
}

interface Missile {
  pos: THREE.Vector3
  vel: THREE.Vector3
  t: number
}
interface Pilot {
  pos: THREE.Vector3
  t: number
}

/**
 * ブルーインパルス編隊。共通パス上を V 字で飛び、色違いのスモークを引く。
 * 全滅すると数秒後に再出現（次の編隊）。
 */
export function Fighters() {
  const [gen, setGen] = useState(0)
  const [mounted, setMounted] = useState(0)
  const curve = useMemo(() => buildCurve(gen), [gen])
  const groups = useRef<THREE.Group[]>([])
  const ents = useRef<Enemy[]>([])
  const u = useRef(0)
  const missiles = useRef<Missile[]>([])
  const pilots = useRef<Pilot[]>([])
  const fireTimer = useRef(FIGHTERS.missileInterval)
  const deadTimer = useRef(0)
  const missileMesh = useRef<THREE.InstancedMesh>(null!)
  const pilotMesh = useRef<THREE.InstancedMesh>(null!)
  const len = useMemo(() => curve.getLength(), [curve])

  useEffect(() => {
    const created = Array.from({ length: FIGHTERS.count }, () => addEnemy('fighter', new THREE.Vector3(0, -1000, 0)))
    ents.current = created
    u.current = 0
    setMounted((m) => m + 1) // 機体 group が揃ってからスモークをマウントする
    return () => {
      for (const e of created) {
        const i = enemies.indexOf(e)
        if (i >= 0) enemies.splice(i, 1)
      }
    }
  }, [gen])

  useEffect(
    () =>
      on('enemy.hit', ({ id, x, y, z }) => {
        if (ents.current.some((e) => e.id === id)) pilots.current.push({ pos: new THREE.Vector3(x, y, z), t: 0 })
      }),
    [],
  )

  const enabledRef = useRef(false)
  useFrame((_, dt) => {
    // 区間ゲート：妹が fromZ を越えるまで出さない
    const imz = refs.imouto?.position.z ?? -Infinity
    const enabled = imz >= FIGHTERS.fromZ
    if (!enabled) {
      if (enabledRef.current) enabledRef.current = false
      ents.current.forEach((e, i) => {
        e.alive = false
        e.pos.set(0, -1000, 0)
        const g = groups.current[i]
        if (g) g.visible = false
      })
      deadTimer.current = 0
      missileMesh.current.count = 0
      pilotMesh.current.count = 0
      return
    }
    if (!enabledRef.current) {
      enabledRef.current = true
      ents.current.forEach((e) => (e.alive = true))
      setGen((g) => g + 1)
      return
    }
    // 編隊の位置
    const stunned = isStunned()
    // 妹の正面付近では減速してホバリング気味に（ロックオンしやすく、大きく見える）
    curve.getPointAt(THREE.MathUtils.clamp(u.current, 0, 1), localP)
    const ang = Math.abs(Math.atan2(localP.x, localP.z)) * (180 / Math.PI)
    const inFront = localP.z > 0 && ang < FIGHTERS.hoverAngleDeg && Math.hypot(localP.x, localP.z) < FIGHTERS.hoverDist
    let spd = FIGHTERS.speed * (inFront ? FIGHTERS.hoverSpeedMul : 1)
    if (stunned) spd *= 0.15
    u.current += (spd * dt) / len
    // 最後尾まで抜けたらこのセットは終わり（生き残りは次の方向へ飛び去った扱い）
    const maxBack = Math.max(...FIGHTERS.formation.map((f) => f[2] < 0 ? -f[2] : 0))
    if (u.current > 1 + maxBack / len + 0.02) ents.current.forEach((e) => (e.alive = false))
    const alive = ents.current.filter((e) => e.alive)
    ents.current.forEach((e, i) => {
      const g = groups.current[i]
      if (!g) return
      // 編隊：機体ごとに [横, 高さ, 後ろ] のオフセット（前後・上下にばらして重ならないように）
      const [fx, fy, fb] = FIGHTERS.formation[i % FIGHTERS.formation.length]
      const uu = THREE.MathUtils.clamp(u.current + fb / len, 0, 1)
      curve.getPointAt(uu, localP)
      toWorld(localP, e.pos)
      curve.getPointAt(Math.min(1, uu + 0.01), localN)
      toWorld(localN, nextT)
      tangent.subVectors(nextT, e.pos).normalize()
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize()
      e.pos.addScaledVector(right, fx)
      e.pos.y += fy
      nextT.addScaledVector(right, fx)
      nextT.y += fy
      g.position.copy(e.pos)
      // 向き
      m4.lookAt(nextT, e.pos, up)
      q.setFromRotationMatrix(m4)
      g.quaternion.copy(q)
      g.visible = e.alive
    })
    // ミサイル
    const im = refs.imouto
    fireTimer.current -= dt
    if (im && alive.length > 0 && fireTimer.current <= 0 && !stunned) {
      fireTimer.current = FIGHTERS.missileInterval
      const shooter = alive[Math.floor(Math.random() * alive.length)]
      const target = new THREE.Vector3(im.position.x + (Math.random() - 0.5) * 10, im.position.y + 6 + Math.random() * 48, im.position.z + (Math.random() - 0.5) * 8)
      const vel = target.sub(shooter.pos).normalize().multiplyScalar(FIGHTERS.missileSpeed)
      missiles.current.push({ pos: shooter.pos.clone(), vel, t: 0 })
    }
    for (let i = missiles.current.length - 1; i >= 0; i--) {
      const ms = missiles.current[i]
      ms.t += dt
      ms.pos.addScaledVector(ms.vel, dt)
      const hit = im && Math.hypot(ms.pos.x - im.position.x, ms.pos.z - im.position.z) < HIT.radius * 0.5 && ms.pos.y > 0 && ms.pos.y < 60
      if (hit) emit('imouto.hit', { x: ms.pos.x, y: ms.pos.y, z: ms.pos.z })
      if (hit || ms.t > 6 || ms.pos.y < 0) missiles.current.splice(i, 1)
    }
    missileMesh.current.count = missiles.current.length
    missiles.current.forEach((ms, i) => {
      m4.identity()
      m4.setPosition(ms.pos)
      missileMesh.current.setMatrixAt(i, m4)
    })
    missileMesh.current.instanceMatrix.needsUpdate = true
    // パイロット（パラシュート）
    for (let i = pilots.current.length - 1; i >= 0; i--) {
      const p = pilots.current[i]
      p.t += dt
      p.pos.y = Math.max(2, p.pos.y - FIGHTERS.pilotFallSpeed * dt)
      p.pos.x += Math.sin(p.t * 1.3) * dt * 2
      if (p.t > FIGHTERS.pilotSec) pilots.current.splice(i, 1)
    }
    pilotMesh.current.count = pilots.current.length
    pilots.current.forEach((p, i) => {
      m4.identity()
      m4.setPosition(p.pos)
      pilotMesh.current.setMatrixAt(i, m4)
    })
    pilotMesh.current.instanceMatrix.needsUpdate = true
    // 全滅→再出現
    if (alive.length === 0 && ents.current.length > 0) {
      deadTimer.current += dt
      if (deadTimer.current > FIGHTERS.respawnSec) {
        deadTimer.current = 0
        setGen((g) => g + 1)
      }
    } else deadTimer.current = 0
  })

  return (
    <group>
      {Array.from({ length: FIGHTERS.count }, (_, i) => (
        <group key={`${gen}-${i}`} ref={(el) => el && (groups.current[i] = el)}>
          <JetMesh />
        </group>
      ))}
      {mounted > 0 &&
        groups.current.length >= FIGHTERS.count &&
        Array.from({ length: FIGHTERS.count }, (_, i) => (
          <SmokeRibbon key={`s${gen}-${i}`} source={groups.current[i]} color={FIGHTERS.smokeColors[i % FIGHTERS.smokeColors.length]} points={FIGHTERS.smokePoints} width={FIGHTERS.smokeWidth} opacity={FIGHTERS.smokeOpacity} />
        ))}
      <instancedMesh ref={missileMesh} args={[undefined, undefined, 32]}>
        <sphereGeometry args={[1.6, 8, 8]} />
        <meshBasicMaterial color="#ffb347" />
      </instancedMesh>
      <instancedMesh ref={pilotMesh} args={[undefined, undefined, 16]}>
        <coneGeometry args={[4, 5, 10]} />
        <meshToonMaterial color="#ffe08a" gradientMap={toonGradient()} />
      </instancedMesh>
    </group>
  )
}
