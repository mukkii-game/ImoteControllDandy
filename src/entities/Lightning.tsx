import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BRO, DUMMY_ENEMIES, LOCKON } from '../config/game'
import { enemies, killEnemy, type Enemy } from '../systems/enemies'
import { projectiles, type Projectile } from '../systems/projectiles'
import { refs } from '../systems/refs'
import { emit } from '../systems/events'
import { useGame } from '../systems/store'

interface Spark {
  pos: THREE.Vector3
  t: number
}

const MAX_SEG = 64
const SPARK_MAX = 24
const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()
const s3 = new THREE.Vector3()
const up = new THREE.Vector3(0, 1, 0)
const p0 = new THREE.Vector3()
const p1 = new THREE.Vector3()
const p2 = new THREE.Vector3()
const dir = new THREE.Vector3()
const side = new THREE.Vector3()
const a = new THREE.Vector3()
const b = new THREE.Vector3()
const seg = new THREE.Vector3()
const mid = new THREE.Vector3()
const ndc = new THREE.Vector3()

type Target = Enemy | Projectile
const alive = (t: Target) => ('alive' in t ? t.alive : !t.dead)

/**
 * 地上の電撃（BRO.lightning）：ボタン不要。サイトが敵の弾か敵を捉えると、兄の右手からそこへ山なりの電撃が伸びる（弾が優先）。
 * 当て続けた秒数で倒す。敵が動いても着弾点はついていき、倒れるまで続く（次にサイトに入った敵へ移る）。サイトから外れると消える。
 * 見た目は 2 次ベジェ（上へふくらみ＋横揺れ）を segments 本の箱でつなぎ、各点をギザギザにずらす（処理が軽い。俯瞰で見ないので隙間は気にしない）。
 * 手元は細く遠くで太くなる（画面が塞がれない）
 */
export function Lightning() {
  const { camera, size } = useThree()
  const outer = useRef<THREE.InstancedMesh>(null!)
  const core = useRef<THREE.InstancedMesh>(null!)
  const sparkMesh = useRef<THREE.InstancedMesh>(null!)
  const sparks = useRef<Spark[]>([])
  const target = useRef<Target | null>(null)
  const held = useRef(0)
  const on = useRef(false)
  const sparkT = useRef(0)
  const time = useRef(0)
  const jitterT = useRef(0)
  /** 各点のずれ（単位ベクトル、幅に掛ける） */
  const jit = useRef(Array.from({ length: MAX_SEG + 1 }, () => new THREE.Vector3()))
  const scoreAcc = useRef(0)
  const lc = BRO.lightning

  useEffect(() => {
    ;(window as unknown as { __lightning: unknown }).__lightning = { target, held, on }
    return () => {
      if (on.current) emit('lightning.stop', undefined)
    }
  }, [])

  /** 点が円形サイト（LOCKON.reticleRadius、画面高さ比）の中か */
  const inRing = (p: THREE.Vector3) => {
    ndc.copy(p).project(camera)
    if (!(ndc.z < 1 && ndc.z > -1)) return false
    const sx = (ndc.x * 0.5 + 0.5) * size.width
    const sy = (-ndc.y * 0.5 + 0.5) * size.height
    const cx = size.width / 2 + refs.reticleX
    const cy = size.height / 2 + refs.reticleY
    return Math.hypot((sx - cx) / size.height, (sy - cy) / size.height) < LOCKON.reticleRadius * lc.ringLeeway
  }

  useFrame((_, dt) => {
    const st = useGame.getState()
    const bro = refs.bro
    time.current += dt
    // ボタン不要：地上（敵の上に乗っている時も）でサイトが敵（弾）を捉えていれば撃つ。ダッシュ中は撃たない
    const firing = !!bro && st.mode === 'ground' && st.phase === 'play' && !refs.broDash
    // 狙い：今の的が生きていて、まだ円形サイトの中にいればそのまま。外へ出たら追うのをやめる。
    // 追っている最中でもサイトに敵の弾が入ってきたら弾を優先し、落としたらまた狙い先を決め直す
    let tg = target.current
    if (tg && !alive(tg)) tg = null
    if (tg && !inRing(tg.pos)) tg = null
    const pj = refs.aimProjectile >= 0 ? projectiles[refs.aimProjectile] : undefined
    if (firing && pj && !pj.dead && tg !== pj) {
      tg = pj
      held.current = 0
    }
    if (firing && !tg) {
      const en = refs.aimTarget >= 0 ? enemies.find((e) => e.id === refs.aimTarget && e.alive) : undefined
      tg = en ?? null
      held.current = 0
    }
    if (!firing) tg = null
    target.current = tg
    const active = !!tg && !!bro
    if (active !== on.current) {
      on.current = active
      emit(active ? 'lightning.start' : 'lightning.stop', undefined)
    }
    refs.lightningOn = active

    let segCount = 0
    if (active && tg && bro) {
      refs.lightningAim.copy(tg.pos)
      // ダメージ：当て続けた秒数
      held.current += dt
      scoreAcc.current += lc.hitScorePerSec * dt
      if (scoreAcc.current >= 10) {
        st.addScore(10)
        scoreAcc.current -= 10
      }
      sparkT.current -= dt
      if (sparkT.current <= 0) {
        sparkT.current = lc.sparkEverySec
        sparks.current.push({ pos: tg.pos.clone(), t: 0 })
        if (sparks.current.length > SPARK_MAX) sparks.current.shift()
      }
      const need = 'alive' in tg ? (tg.kind === 'boss' ? lc.bossKillSec : lc.killSec) : lc.projectileSec
      if (held.current >= need) {
        if ('alive' in tg) {
          killEnemy(tg.id, tg.kind === 'dummy' ? DUMMY_ENEMIES.respawnSec : 0)
          dir.subVectors(tg.pos, bro.position).normalize()
          emit('enemy.hit', { id: tg.id, x: tg.pos.x, y: tg.pos.y, z: tg.pos.z, dir: [dir.x, Math.max(0.4, dir.y), dir.z] })
          st.addScore(lc.killScore)
        } else {
          tg.dead = true
          emit('bomb.burst', { x: tg.pos.x, y: tg.pos.y, z: tg.pos.z })
          st.addScore(lc.projectileScore)
        }
        target.current = null
        held.current = 0
      }
      // 形：手（無ければ足元＋muzzleHeight）→ 的。制御点は中点を上へ（arcUp）＋横へ揺らす（arcSide）
      if (refs.broHand) refs.broHand.getWorldPosition(p0)
      else p0.set(bro.position.x, bro.position.y + lc.muzzleHeight, bro.position.z)
      p2.copy(tg.pos)
      dir.subVectors(p2, p0)
      const dist = dir.length()
      if (dist > 0.5) {
        dir.multiplyScalar(1 / dist)
        side.crossVectors(dir, up)
        if (side.lengthSq() < 1e-4) side.set(1, 0, 0)
        side.normalize()
        mid.lerpVectors(p0, p2, 0.5)
        p1.copy(mid).addScaledVector(up, lc.arcUp * dist).addScaledVector(side, lc.arcSide * dist * Math.sin(time.current * lc.swaySpeed))
        // ずれの取り直し
        jitterT.current -= dt
        const n = Math.min(MAX_SEG, Math.max(2, Math.floor(lc.segments)))
        if (jitterT.current <= 0) {
          jitterT.current = lc.jitterEverySec
          for (let i = 0; i <= n; i++) {
            const j = jit.current[i]
            if (i === 0 || i === n) {
              j.set(0, 0, 0)
              continue
            }
            j.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
            // 進行方向の成分は落とす（横にだけずれる）
            j.addScaledVector(dir, -j.dot(dir))
            if (j.lengthSq() > 1e-6) j.normalize()
          }
        }
        const width = (d: number) => {
          const k = THREE.MathUtils.clamp((d - lc.thickenFrom) / Math.max(1, lc.thickenTo - lc.thickenFrom), 0, 1)
          return THREE.MathUtils.lerp(lc.nearWidth, lc.farWidth, k * k * (3 - 2 * k))
        }
        const point = (i: number, out: THREE.Vector3) => {
          const s = i / n
          const u = 1 - s
          out.set(
            u * u * p0.x + 2 * u * s * p1.x + s * s * p2.x,
            u * u * p0.y + 2 * u * s * p1.y + s * s * p2.y,
            u * u * p0.z + 2 * u * s * p1.z + s * s * p2.z,
          )
          out.addScaledVector(jit.current[i], width(s * dist) * lc.jitter)
          // うねり：進行方向に沿った波（時間で流れる）。両端は 0
          const wv = Math.sin(s * Math.PI * lc.waveFreq + time.current * lc.waveSpeed) * Math.sin(s * Math.PI) * lc.waveAmp * dist
          out.addScaledVector(side, wv).addScaledVector(up, wv * 0.5)
          return out
        }
        const om = outer.current
        const cm = core.current
        point(0, a)
        for (let i = 0; i < n; i++) {
          point(i + 1, b)
          seg.subVectors(b, a)
          const len = seg.length()
          if (len < 1e-3) {
            a.copy(b)
            continue
          }
          seg.multiplyScalar(1 / len)
          q.setFromUnitVectors(up, seg)
          mid.lerpVectors(a, b, 0.5)
          const w = width(((i + 0.5) / n) * dist)
          s3.set(w, len * 1.15, w)
          m4.compose(mid, q, s3)
          om.setMatrixAt(segCount, m4)
          const cw = w * lc.coreRatio
          s3.set(cw, len * 1.15, cw)
          m4.compose(mid, q, s3)
          cm.setMatrixAt(segCount, m4)
          segCount++
          a.copy(b)
        }
      }
    }
    outer.current.count = segCount
    core.current.count = segCount
    outer.current.instanceMatrix.needsUpdate = true
    core.current.instanceMatrix.needsUpdate = true
    // 火花：膨らんで消える
    const sp = sparks.current
    for (let i = sp.length - 1; i >= 0; i--) {
      sp[i].t += dt
      if (sp[i].t > lc.sparkSec) sp.splice(i, 1)
    }
    const sm = sparkMesh.current
    sm.count = sp.length
    sp.forEach((s, i) => {
      const k = s.t / lc.sparkSec
      s3.setScalar(lc.sparkSize * (0.3 + 0.7 * k) + 0.001)
      m4.compose(s.pos, q.identity(), s3)
      sm.setMatrixAt(i, m4)
    })
    sm.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={outer} args={[undefined, undefined, MAX_SEG]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={lc.color} transparent opacity={lc.opacity} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={core} args={[undefined, undefined, MAX_SEG]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={lc.coreColor} />
      </instancedMesh>
      <instancedMesh ref={sparkMesh} args={[undefined, undefined, SPARK_MAX]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#dff6ff" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
    </group>
  )
}
