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
import { XrayRoot } from '../systems/xray'

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
const loiterP = new THREE.Vector3()
const loiterN = new THREE.Vector3()
const sweepL = new THREE.Vector3()
const viewR = new THREE.Vector3()
const bombAim = new THREE.Vector3()

/**
 * 編隊の「横」方向：ロロから見て画面の横になる向き（ロロ→機体の視線に直交する水平ベクトル）。
 * 進行方向の右にすると、横切って飛ぶときに一列縦隊に見えてしまうので、常にロロから見て横一列になるようにする
 */
function viewRight(base: THREE.Vector3, fallback: THREE.Vector3, out: THREE.Vector3) {
  const im = refs.imouto
  if (!im) return out.copy(fallback)
  const dx = base.x - im.position.x
  const dz = base.z - im.position.z
  const l = Math.hypot(dx, dz)
  if (l < 1) return out.copy(fallback)
  return out.set(dz / l, 0, -dx / l)
}
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
export function Fighters({ squad = 0 }: { squad?: number }) {
  // 編隊ごとにパスの順番をずらす（squad 番目の編隊は squad 個先の方向から入る）
  const [gen, setGen] = useState(squad)
  const [mounted, setMounted] = useState(0)
  const curve = useMemo(() => buildCurve(gen), [gen])
  const groups = useRef<THREE.Group[]>([])
  const ents = useRef<Enemy[]>([])
  const u = useRef(0)
  const missiles = useRef<Missile[]>([])
  const bombs = useRef<Missile[]>([])
  const bombTimer = useRef(1)
  const bombMesh = useRef<THREE.InstancedMesh>(null!)
  const bombHalo = useRef<THREE.InstancedMesh>(null!)
  const pilots = useRef<Pilot[]>([])
  const fireTimer = useRef(FIGHTERS.missileInterval)
  const deadTimer = useRef(0)
  const missileMesh = useRef<THREE.InstancedMesh>(null!)
  const pilotMesh = useRef<THREE.InstancedMesh>(null!)
  const len = useMemo(() => curve.getLength(), [curve])
  /** 滞在（旋回）の状態。セットごとにリセット */
  const loiter = useRef({ active: false, done: false, t: 0, dur: 0, angle: 0, k: 0, center: new THREE.Vector3() })

  useEffect(() => {
    const created = Array.from({ length: FIGHTERS.count }, () => addEnemy('fighter', new THREE.Vector3(0, -1000, 0)))
    ents.current = created
    u.current = 0
    loiter.current = { active: false, done: false, t: 0, dur: 0, angle: Math.random() * Math.PI * 2, k: 0, center: new THREE.Vector3() }
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
      bombMesh.current.count = 0
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
    // 滞在：正面付近に着いたら、しばらくプレイヤーの近くを旋回してから抜ける（1 セット 1 回）
    const lo = FIGHTERS.loiter
    const kindName = FIGHTERS.passes[gen % FIGHTERS.passes.length].loiter
    const kind = lo.kinds[kindName]
    const overhead = kindName === 'overhead'
    const L = loiter.current
    // 上空集合はパスが妹の真上付近（前後 200m 以内）に来たら開始
    const reach = overhead ? Math.hypot(localP.x, localP.z) < 220 : inFront
    if (!L.done && !L.active && reach) {
      L.active = true
      L.t = 0
      L.dur = kind.secMin + Math.random() * (kind.secMax - kind.secMin)
      L.center.set(...(overhead ? lo.overheadCenter : (kind.center as [number, number, number])))
      L.angle = Math.random() < 0.5 ? 0 : Math.PI // 横切る向きをランダムに
    }
    if (L.active) {
      L.t += dt
      L.angle += kind.speed * (stunned ? 0.2 : 1) * dt
      if (L.t >= L.dur) {
        L.active = false
        L.done = true
      }
    }
    const kWant = L.active ? Math.min(1, L.t / lo.blendSec, (L.dur - L.t) / lo.blendSec) : 0
    L.k += (kWant - L.k) * Math.min(1, 3 * dt)
    u.current += ((spd * dt) / len) * (1 - L.k)
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
      viewRight(e.pos, right, viewR)
      e.pos.addScaledVector(viewR, fx)
      e.pos.y += fy
      nextT.addScaledVector(viewR, fx)
      nextT.y += fy
      if (L.k > 0.001) {
        // 滞在中の位置（機体ごとの並びは、ロロから見た横方向と高さに沿って付ける）
        const posAt = (a: number, out: THREE.Vector3) => {
          if (overhead) {
            // 上空：中心の周りを回る（機体ごとに位相をずらす）
            const ph = (i / FIGHTERS.count) * Math.PI * 2
            const R = kind.radius + fx * 0.6
            toWorld(L.center, out)
            out.x += Math.cos(a + ph) * R
            out.z += Math.sin(a + ph) * R
            out.y += fy + Math.sin((a + ph) * 1.3) * lo.heightWobble
          } else {
            // 近く／遠く：ロロの前を斜めに大きく横切る（リサージュ）。横に連なった線がそのまま動く
            const [cx, cy, cz] = kind.center
            const [ax, ay, az] = kind.amp
            sweepL.set(cx + ax * Math.sin(a), cy + ay * Math.sin(2 * a + 0.8), cz + az * Math.cos(a))
            toWorld(sweepL, out)
            viewRight(out, right, viewR)
            out.addScaledVector(viewR, fx)
            out.y += fy
          }
        }
        posAt(L.angle, loiterP)
        posAt(L.angle + 0.06, loiterN)
        e.pos.lerp(loiterP, L.k)
        nextT.lerp(loiterN, L.k)
      }
      g.position.copy(e.pos)
      // 向き
      m4.lookAt(nextT, e.pos, up)
      q.setFromRotationMatrix(m4)
      g.quaternion.copy(q)
      g.visible = e.alive
    })
    // 爆撃（上空集合の滞在中）：機体から爆弾を落とす。妹にダメージは無いが被弾エフェクトは出る
    const im = refs.imouto
    const bc = FIGHTERS.bomb
    bombTimer.current -= dt
    if (im && overhead && L.active && L.k > 0.5 && alive.length > 0 && bombTimer.current <= 0 && !stunned) {
      bombTimer.current = bc.interval
      const b = alive[Math.floor(Math.random() * alive.length)]
      // 妹の胴体へ向けてゆっくり飛ぶ
      const start = b.pos.clone().setY(b.pos.y - 3)
      const aim = new THREE.Vector3(im.position.x, im.position.y + 35, im.position.z).sub(start).normalize().multiplyScalar(bc.speed)
      bombs.current.push({ pos: start, vel: aim, t: 0 })
    }
    for (let i = bombs.current.length - 1; i >= 0; i--) {
      const bm = bombs.current[i]
      bm.t += dt
      if (im) {
        // 妹の方へゆるく曲がる（ホーミング）
        bombAim.set(im.position.x, im.position.y + 35, im.position.z).sub(bm.pos).normalize().multiplyScalar(bc.speed)
        bm.vel.lerp(bombAim, Math.min(1, bc.homing * dt))
      }
      bm.vel.y -= bc.gravity * dt
      bm.pos.addScaledVector(bm.vel, dt)
      const near = im && Math.hypot(bm.pos.x - im.position.x, bm.pos.z - im.position.z) < bc.hitRadius
      const hitBody = near && bm.pos.y < 62 && bm.pos.y > 8
      if (hitBody) emit('imouto.hit', { x: bm.pos.x, y: bm.pos.y, z: bm.pos.z })
      else if (bm.pos.y <= 1) emit('bomb.burst', { x: bm.pos.x, y: 2, z: bm.pos.z })
      if (hitBody || bm.pos.y <= 1 || bm.t > 20) bombs.current.splice(i, 1)
    }
    bombMesh.current.count = bombs.current.length
    bombHalo.current.count = bombs.current.length
    const haloPulse = 1 + 0.18 * Math.sin(performance.now() / 1000 * bc.pulse)
    bombs.current.forEach((bm, i) => {
      m4.identity()
      m4.setPosition(bm.pos)
      bombMesh.current.setMatrixAt(i, m4)
      m4.makeScale(haloPulse, haloPulse, haloPulse)
      m4.setPosition(bm.pos)
      bombHalo.current.setMatrixAt(i, m4)
    })
    bombMesh.current.instanceMatrix.needsUpdate = true
    bombHalo.current.instanceMatrix.needsUpdate = true
    // ミサイル
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
    <XrayRoot>
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
      {/* 爆弾：黒い玉と、その周りの明るい光（見えやすく） */}
      <instancedMesh ref={bombMesh} args={[undefined, undefined, 48]}>
        <sphereGeometry args={[FIGHTERS.bomb.size, 10, 8]} />
        <meshBasicMaterial color={FIGHTERS.bomb.color} />
      </instancedMesh>
      <instancedMesh ref={bombHalo} args={[undefined, undefined, 48]} userData={{ noXray: true }}>
        <sphereGeometry args={[FIGHTERS.bomb.haloSize, 10, 8]} />
        <meshBasicMaterial color={FIGHTERS.bomb.haloColor} transparent opacity={FIGHTERS.bomb.haloOpacity} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={missileMesh} args={[undefined, undefined, 32]}>
        <sphereGeometry args={[1.6, 8, 8]} />
        <meshBasicMaterial color="#ffb347" />
      </instancedMesh>
      <instancedMesh ref={pilotMesh} args={[undefined, undefined, 16]}>
        <coneGeometry args={[4, 5, 10]} />
        <meshToonMaterial color="#ffe08a" gradientMap={toonGradient()} />
      </instancedMesh>
    </XrayRoot>
  )
}
