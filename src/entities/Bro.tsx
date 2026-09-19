import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BRO, SCALE, LOCKON, IMOUTO, CAMERA, GAME, SPEECH } from '../config/game'
import { enemies, killEnemy, lock, clearLocks } from '../systems/enemies'
import { DUMMY_ENEMIES } from '../config/game'
import { useModels, candidates } from '../systems/models'
import { readMove, useInput } from '../systems/input'
import { refs, shoulderWorld } from '../systems/refs'
import { buildingAt } from '../systems/colliders'
import { makeSilhouette, type Silhouette } from '../systems/silhouette'
import { useGame } from '../systems/store'
import { useVRM } from '../systems/loaders'
import { emit } from '../systems/events'
import { applyWalk, applyShoulderPose, applyFlyPose, applyPunchPose } from '../systems/procAnim'

const v = new THREE.Vector3()
const target = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * 兄。VRM の少年を学生服風に色替え。WASD はカメラ基準で移動、Space ジャンプ。
 * B（Shift）でどこからでも肩へ飛び乗り、肩上で B で飛び降りる。
 */
export function Bro() {
  const group = useRef<THREE.Group>(null!)
  const yawRef = useRef(Math.PI)
  const vy = useRef(0)
  const phase = useRef(0)
  const runRatio = useRef(0)
  /** 肩上の指示：null=腕組み, 0=前, -1=左, 1=右 */
  const steer = useRef<number | null>(null)
  const poseBlend = useRef(0)
  /** 投擲シーケンス */
  const throwSeq = useRef<{
    targets: number[]
    idx: number
    phase: 'windup' | 'fly' | 'pause' | 'return'
    t: number
    from: THREE.Vector3
    hits: number
    /** 肩上から妹に投げられたか、地上から自力で跳んだか */
    origin: 'shoulder' | 'ground'
    /** 今向かっている敵をダッシュ打撃で殴るか（地上・近距離） */
    melee: boolean
    /** 1 体目への曲線ルート（無ければ直線） */
    curve: THREE.CubicBezierCurve3 | null
    curveLen: number
  }>({
    targets: [],
    idx: 0,
    phase: 'windup',
    t: 0,
    from: new THREE.Vector3(),
    hits: 0,
    origin: 'shoulder',
    melee: false,
    curve: null,
    curveLen: 0,
  })
  const wasA = useRef(false)
  const wasLeft = useRef(false)
  const wasRight = useRef(false)
  const turnSayT = useRef(0)
  /** 地上の高速タックル */
  const tackle = useRef({ active: false, queued: false, t: 0, hits: 0, dist: BRO.tackle.distance, dir: new THREE.Vector3(), from: new THREE.Vector3() })
  const tackleCd = useRef(0)
  const fadeK = useRef(0)
  const silhouette = useRef<Silhouette | null>(null)
  /** 行き先（▼）をロックしていたら妹に「あそこへ行け」 */
  const orderDest = () => {
    if (!lock.dest) return
    lock.dest = false
    const d = GAME.dest
    useGame.getState().setWaypoint({ x: d.x, z: d.z })
    emit('bro.goto', { x: d.x, z: d.z })
  }
  const punchT = useRef(0)
  const selected = useModels((s) => s.bro)
  const setResolved = useModels((s) => s.setResolved)
  const { vrm, choice } = useVRM(candidates('bro', selected))
  const setLoaded = useGame((s) => s.setLoaded)
  const tuneVersion = useGame((s) => s.tuneVersion)

  const modelHeight = useMemo(() => {
    if (!vrm) return 1
    const box = new THREE.Box3().setFromObject(vrm.scene)
    return box.max.y - box.min.y
  }, [vrm])
  const scale = SCALE.broHeight / modelHeight
  void tuneVersion

  useEffect(() => {
    refs.bro = group.current
    return () => {
      refs.bro = null
    }
  }, [])

  useEffect(() => {
    if (!vrm) return
    // モデルごとの非表示・色替え（Seed-san の学生服風など）
    const tint = new THREE.Color(choice?.tintColor ?? '#ffffff')
    const hide = choice?.hideMaterials ?? []
    const tints = choice?.tintMaterials ?? []
    vrm.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        const name = m.name ?? ''
        if (hide.some((k) => name.includes(k))) mesh.visible = false
        if (tints.some((k) => name.includes(k))) {
          const mm = m as THREE.Material & { color?: THREE.Color; shadeColorFactor?: THREE.Color }
          mm.color?.copy(tint)
          mm.shadeColorFactor?.copy(tint).multiplyScalar(0.55)
        }
      }
    })
    setLoaded('bro')
    if (choice) setResolved('bro', choice)
  }, [vrm, choice, setLoaded, setResolved])

  useFrame((_, dt) => {
    const g = group.current
    const st = useGame.getState()
    const input = useInput.getState()
    const playing = st.phase === 'play'
    const pressedB = playing && input.consumeB()
    const pressedA = playing && input.consumeA()
    let moving = 0

    if (st.phase === 'title' && refs.imouto && st.mode === 'ground') {
      // タイトル：画面下に立って妹を見上げる位置に固定
      const im = refs.imouto
      const yaw = im.rotation.y
      const c = CAMERA.title
      g.position.set(im.position.x + Math.sin(yaw) * c.broAhead + Math.cos(yaw) * c.broSide, 0, im.position.z + Math.cos(yaw) * c.broAhead - Math.sin(yaw) * c.broSide)
      yawRef.current = yaw + Math.PI
      g.rotation.y = yawRef.current
      vrm?.humanoid.getNormalizedBoneNode('head')?.rotation.set(-0.6, 0, 0)
    }
    switch (st.mode) {
      case 'ground': {
        const m = readMove()
        // カメラ基準：camYaw の向きが「前」
        const camYaw = refs.camYaw
        const fx = Math.sin(camYaw)
        const fz = Math.cos(camYaw)
        // カメラの右方向（前方 (sin,cos) に対して右は (-cos, sin)）
        const rx = -Math.cos(camYaw)
        const rz = Math.sin(camYaw)
        const dx = fx * m.y + rx * m.x
        const dz = fz * m.y + rz * m.x
        const mag = Math.hypot(dx, dz)
        const tk = tackle.current
        const tc = BRO.tackle
        if (mag > 0.001 && !tk.active) {
          const sp = BRO.runSpeed * Math.min(1, mag)
          const nx = g.position.x + (dx / mag) * sp * dt
          const nz = g.position.z + (dz / mag) * sp * dt
          // 建物は貫通できない
          if (!buildingAt(nx, nz, BRO.bodyRadius)) {
            g.position.x = nx
            g.position.z = nz
          }
          const want = Math.atan2(dx, dz)
          let diff = want - yawRef.current
          diff = Math.atan2(Math.sin(diff), Math.cos(diff))
          yawRef.current += diff * Math.min(1, BRO.turnLerp * dt)
          moving = Math.min(1, mag)
        }
        // 地上の攻撃：A（左クリック）でカーソル（カメラ）の向きへ高速タックル。
        // 自分の背丈くらいの弧を描いて一定距離（敵がいてもいなくても）。敵で止まらず当たった敵は全部倒す。建物で止まる。連打で高速移動になる
        tackleCd.current = Math.max(0, tackleCd.current - dt)
        if (pressedA) tk.queued = true
        if (tk.queued && !tk.active && tackleCd.current <= 0) {
          tk.queued = false
          tk.active = true
          tk.t = 0
          tk.hits = 0
          // 向き：サイトが倒せる敵に重なっていればその敵へ（全距離）。そうでなければサイトの向き（カメラの向き＋サイトの左右のずれ）へ半分の距離
          const target = refs.groundTarget >= 0 ? enemies.find((e) => e.id === refs.groundTarget && e.alive) : undefined
          let aimYaw: number
          if (target) {
            aimYaw = Math.atan2(target.pos.x - g.position.x, target.pos.z - g.position.z)
            tk.dist = tc.distance
          } else {
            const hfov = THREE.MathUtils.degToRad(CAMERA.ground.fov) * (window.innerWidth / window.innerHeight) * 0.5
            aimYaw = refs.camYaw - (refs.reticleX / (window.innerWidth / 2)) * hfov * 0.6
            tk.dist = tc.distance * tc.missDistanceMul
          }
          tk.dir.set(Math.sin(aimYaw), 0, Math.cos(aimYaw))
          tk.from.copy(g.position)
          yawRef.current = aimYaw
          emit('bro.tackle', undefined)
        }
        if (tk.active) {
          const dur = tk.dist / tc.speed
          tk.t += dt
          const k = Math.min(1, tk.t / dur)
          const nx = tk.from.x + tk.dir.x * tk.dist * k
          const nz = tk.from.z + tk.dir.z * tk.dist * k
          if (buildingAt(nx, nz, BRO.bodyRadius)) {
            // 建物にぶつかったらそこで止まる
            tk.active = false
            tackleCd.current = tc.cooldownSec
            vy.current = 0
          } else {
            g.position.x = nx
            g.position.z = nz
            g.position.y = Math.sin(k * Math.PI) * SCALE.broHeight * tc.arcHeight
            moving = 1
            for (const e of enemies) {
              if (!e.alive || e.pos.y > tc.maxHeight) continue
              if (Math.hypot(e.pos.x - g.position.x, e.pos.z - g.position.z) < tc.radius) {
                killEnemy(e.id, e.kind === 'dummy' ? DUMMY_ENEMIES.respawnSec : 0)
                tk.hits++
                emit('enemy.hit', { id: e.id, x: e.pos.x, y: e.pos.y, z: e.pos.z, dir: [tk.dir.x, 0.5, tk.dir.z] })
                st.addScore(100 * tk.hits)
                if (tk.hits > 1) st.setCombo(tk.hits)
              }
            }
            if (k >= 1) {
              tk.active = false
              tackleCd.current = tc.cooldownSec
              vy.current = 0
            }
          }
        }
        refs.broDash = tk.active
        wasA.current = input.keys.a && playing
        punchT.current = Math.max(0, punchT.current - dt)
        if (!tk.active) {
          vy.current -= BRO.gravity * dt
          g.position.y = Math.max(0, g.position.y + vy.current * dt)
          if (g.position.y <= 0) vy.current = Math.max(0, vy.current)
        }
        g.rotation.y = yawRef.current

        if (pressedB && refs.shoulder) {
          refs.mountStart.copy(g.position)
          const d = refs.mountStart.distanceTo(shoulderWorld(v))
          refs.mountDuration = THREE.MathUtils.clamp(d / 120, BRO.mountSecMin, BRO.mountSecMax)
          st.setTransition(0)
          st.setMode('mounting')
          emit('bro.mount', undefined)
        }
        break
      }
      case 'mounting': {
        const t = Math.min(1, st.transition + dt / refs.mountDuration)
        st.setTransition(t)
        shoulderWorld(target)
        const e = easeInOut(t)
        g.position.lerpVectors(refs.mountStart, target, e)
        g.position.y += Math.sin(t * Math.PI) * SCALE.imoutoHeight * BRO.mountArc
        const dx = target.x - refs.mountStart.x
        const dz = target.z - refs.mountStart.z
        if (Math.hypot(dx, dz) > 1) yawRef.current = Math.atan2(dx, dz)
        g.rotation.y = yawRef.current
        g.rotation.x = -Math.sin(t * Math.PI) * 0.6
        moving = 1
        if (t >= 1) {
          g.rotation.x = 0
          st.setMode('shoulder')
        }
        break
      }
      case 'shoulder': {
        shoulderWorld(v)
        g.position.copy(v)
        yawRef.current = refs.imouto?.rotation.y ?? 0
        g.rotation.y = yawRef.current
        // 肩上は常に腕組み（指差しは一旦オフ。BRO.pointWhileSteering で復活）
        const m = readMove()
        steer.current = BRO.pointWhileSteering ? (m.y > 0.2 ? (m.x > 0.3 ? 1 : m.x < -0.3 ? -1 : 0) : m.x > 0.3 ? 1 : m.x < -0.3 ? -1 : m.y > 0.2 ? 0 : null) : null
        // 旋回の指示（A D を押した瞬間にセリフ。連発は抑える）
        turnSayT.current = Math.max(0, turnSayT.current - dt)
        const leftNow = playing && input.keys.left
        const rightNow = playing && input.keys.right
        if (turnSayT.current <= 0 && ((leftNow && !wasLeft.current) || (rightNow && !wasRight.current))) {
          emit('bro.say', { text: leftNow && !wasLeft.current ? SPEECH.lines.turnLeft : SPEECH.lines.turnRight })
          turnSayT.current = SPEECH.turnCooldownSec
        }
        wasLeft.current = leftNow
        wasRight.current = rightNow
        // A を押した瞬間（溜め開始）：「オレを投げろ！」。離した瞬間：行き先ロックなら指示、敵ロックがあれば投擲開始
        const aNow = input.keys.a && playing
        if (aNow && !wasA.current) emit('bro.charge', undefined)
        if (wasA.current && !aNow) orderDest()
        if (wasA.current && !aNow && lock.ids.length > 0) {
          const seq = throwSeq.current
          seq.targets = [...lock.ids]
          seq.idx = 0
          seq.phase = 'windup'
          seq.t = 0
          seq.hits = 0
          seq.origin = 'shoulder'
          seq.melee = false
          seq.from.copy(g.position)
          clearLocks()
          st.setAttackFrom('shoulder')
          st.setMode('thrown')
          emit('bro.throw', { count: seq.targets.length, from: seq.origin })
        }
        wasA.current = aNow
        if (pressedB) {
          refs.mountStart.copy(g.position)
          st.setTransition(0)
          st.setMode('dismounting')
          emit('bro.dismount', undefined)
        }
        break
      }
      case 'thrown': {
        const seq = throwSeq.current
        seq.t += dt
        moving = 1
        const nextTarget = () => {
          while (seq.idx < seq.targets.length) {
            const e = enemies.find((x) => x.id === seq.targets[seq.idx])
            if (e && e.alive) return e
            seq.idx++
          }
          return null
        }
        const fromGround = seq.origin === 'ground'
        const gc = LOCKON.ground
        /** 次の敵へ向かう準備。地上発で近く・低い敵ならダッシュ打撃にする。1 体目はベジェ曲線で大きく回り込む */
        const beginFly = (first: boolean) => {
          seq.phase = 'fly'
          seq.t = 0
          seq.from.copy(g.position)
          const e = nextTarget()
          seq.melee = !!e && fromGround && e.pos.y <= gc.meleeMaxHeight && Math.hypot(e.pos.x - g.position.x, e.pos.z - g.position.z) <= BRO.punchRange
          seq.curve = null
          if (e && first && !seq.melee) {
            const c = LOCKON.curve
            const dir = new THREE.Vector3().subVectors(e.pos, g.position)
            const dist = dir.length()
            dir.normalize()
            const side = new THREE.Vector3().crossVectors(dir, UP)
            if (side.lengthSq() < 0.01) side.set(1, 0, 0)
            side.normalize()
            // 妹の体から離れる側へ膨らむ（肩上なら体を突き抜けない）
            const im = refs.imouto?.position
            const away = im ? Math.sign(side.dot(v.subVectors(g.position, im))) || 1 : 1
            side.multiplyScalar(away)
            const p1 = g.position.clone().addScaledVector(dir, dist * 0.25).addScaledVector(side, dist * c.side).addScaledVector(UP, dist * c.up)
            const p2 = e.pos.clone().addScaledVector(dir, -dist * 0.25).addScaledVector(side, dist * c.sideEnd).addScaledVector(UP, dist * c.upEnd)
            const curve = new THREE.CubicBezierCurve3(g.position.clone(), p1, p2, e.pos.clone())
            curve.arcLengthDivisions = 60
            seq.curve = curve
            seq.curveLen = curve.getLength()
          }
        }
        if (seq.phase === 'windup') {
          const windup = fromGround ? gc.windupSec : LOCKON.windupSec
          if (fromGround) {
            // 地上：その場で小さく跳ねてタメ
            g.position.x = seq.from.x
            g.position.z = seq.from.z
            g.position.y = seq.from.y + Math.sin(Math.min(1, seq.t / windup) * Math.PI) * gc.hopHeight
          } else {
            // 妹の肩で一瞬タメ（妹の腕が振りかぶる時間）。位置は肩に追従
            shoulderWorld(v)
            g.position.copy(v)
            g.position.y += Math.sin(Math.min(1, seq.t / windup) * Math.PI) * 4
          }
          if (seq.t >= windup) beginFly(true)
        } else if (seq.phase === 'fly') {
          const e = nextTarget()
          if (!e) {
            seq.phase = 'return'
            seq.t = 0
            seq.from.copy(g.position)
          } else {
            let k: number
            if (seq.curve) {
              // 1 体目：ベジェ曲線で回り込む。敵が動くので終点だけ追従させる
              const cv = seq.curve
              if (cv.v3.distanceToSquared(e.pos) > 1) {
                cv.v3.copy(e.pos)
                cv.updateArcLengths()
                seq.curveLen = cv.getLength()
              }
              // 距離に関係なくほぼ一定時間で着く（遠いほど加速）
              const dur = THREE.MathUtils.clamp(seq.curveLen / LOCKON.flySpeed, LOCKON.hopMinSec, LOCKON.hopSec)
              k = Math.min(1, seq.t / dur)
              cv.getPointAt(k, g.position)
              cv.getTangentAt(k, v)
              if (Math.hypot(v.x, v.z) > 0.05) yawRef.current = Math.atan2(v.x, v.z)
            } else {
              // 2 体目以降：真っ直ぐ（ダッシュ打撃は地面を走る）
              const dist = seq.from.distanceTo(e.pos)
              const dur = seq.melee ? Math.max(0.12, dist / gc.dashSpeed) : THREE.MathUtils.clamp(dist / LOCKON.flySpeed, LOCKON.hopMinSec, LOCKON.hopSec)
              k = Math.min(1, seq.t / dur)
              g.position.lerpVectors(seq.from, e.pos, k)
              if (seq.melee) g.position.y = THREE.MathUtils.lerp(seq.from.y, 0, k)
              const dx = e.pos.x - seq.from.x
              const dz = e.pos.z - seq.from.z
              if (Math.hypot(dx, dz) > 0.5) yawRef.current = Math.atan2(dx, dz)
            }
            if (k >= 1) {
              killEnemy(e.id, e.kind === 'dummy' ? DUMMY_ENEMIES.respawnSec : 0)
              seq.hits++
              v.subVectors(e.pos, seq.from)
              if (v.lengthSq() > 1) v.normalize()
              emit('enemy.hit', { id: e.id, x: e.pos.x, y: e.pos.y, z: e.pos.z, dir: [v.x, Math.max(0.35, v.y), v.z] })
              if (seq.melee) punchT.current = 0.35
              seq.idx++
              seq.phase = 'pause'
              seq.t = 0
              seq.from.copy(g.position)
            }
          }
        } else if (seq.phase === 'pause') {
          if (seq.t >= LOCKON.hitPauseSec) {
            if (nextTarget()) beginFly(false)
            else {
              seq.phase = 'return'
              seq.t = 0
              seq.from.copy(g.position)
            }
          }
        } else if (seq.phase === 'return') {
          const finish = () => {
            if (seq.hits > 0) {
              st.addScore(Math.round(100 * seq.hits * (seq.hits > 1 ? seq.hits * LOCKON.comboMulti : 1)))
              if (seq.hits > 1) st.setCombo(seq.hits)
            }
            wasA.current = input.keys.a
            emit('bro.return', undefined)
          }
          if (fromGround) {
            // 地上発：その場から真下の地面へ降りる
            const k = Math.min(1, seq.t / gc.landSec)
            g.position.x = seq.from.x
            g.position.z = seq.from.z
            g.position.y = seq.from.y * (1 - easeInOut(k))
            if (k >= 1) {
              g.position.y = 0
              vy.current = 0
              st.setMode('ground')
              finish()
            }
          } else {
            const k = Math.min(1, seq.t / LOCKON.returnSec)
            shoulderWorld(target)
            const e = easeInOut(k)
            g.position.lerpVectors(seq.from, target, e)
            g.position.y += Math.sin(k * Math.PI) * SCALE.imoutoHeight * LOCKON.returnArc
            const dx = target.x - seq.from.x
            const dz = target.z - seq.from.z
            if (Math.hypot(dx, dz) > 1) yawRef.current = Math.atan2(dx, dz)
            if (k >= 1) {
              st.setMode('shoulder')
              finish()
            }
          }
        }
        g.rotation.y = yawRef.current
        break
      }
      case 'dismounting': {
        const t = Math.min(1, st.transition + dt / BRO.dismountSec)
        st.setTransition(t)
        const im = refs.imouto
        const yaw = im?.rotation.y ?? 0
        target.set(
          (im?.position.x ?? 0) + Math.sin(yaw) * BRO.dismountAhead + Math.cos(yaw) * BRO.dismountSide,
          0,
          (im?.position.z ?? 0) + Math.cos(yaw) * BRO.dismountAhead - Math.sin(yaw) * BRO.dismountSide,
        )
        const e = easeOut(t)
        g.position.x = THREE.MathUtils.lerp(refs.mountStart.x, target.x, e)
        g.position.z = THREE.MathUtils.lerp(refs.mountStart.z, target.z, e)
        const up = Math.sin(Math.min(1, t * 2) * Math.PI * 0.5) * 6
        g.position.y = refs.mountStart.y * (1 - easeInOut(t)) + up * (1 - t)
        g.rotation.y = yaw
        moving = 1
        if (t >= 1) {
          g.position.y = 0
          vy.current = 0
          st.setMode('ground')
        }
        break
      }
    }
    refs.broYaw = yawRef.current

    if (vrm) {
      // 射撃モード（肩上で溜め中）：妹と同じく一瞬で消える
      {
        const want = st.charging && st.mode === 'shoulder'
        fadeK.current = THREE.MathUtils.clamp(fadeK.current + (want ? dt / CAMERA.aim.fadeSec : -dt / CAMERA.aim.showFadeSec), 0, 1)
        if (!silhouette.current) silhouette.current = makeSilhouette(vrm.scene, CAMERA.aim.silhouetteColor)
        silhouette.current.blend(fadeK.current, CAMERA.aim.silhouetteOpacity)
      }
      const seq = throwSeq.current
      const onShoulder = st.mode === 'shoulder' || (st.mode === 'thrown' && seq.phase === 'windup' && seq.origin === 'shoulder')
      poseBlend.current += ((onShoulder ? 1 : 0) - poseBlend.current) * Math.min(1, 8 * dt)
      const inMelee = st.mode === 'thrown' && seq.origin === 'ground' && (seq.melee || seq.phase === 'windup' || (seq.phase === 'pause' && punchT.current > 0))
      if (st.mode === 'thrown' && seq.phase !== 'windup' && !inMelee) {
        // ライダーキック姿勢。飛行方向へ体を倒す
        applyFlyPose(vrm, dt)
        g.rotation.x = seq.phase === 'return' ? -0.4 : 0.9
      } else if (poseBlend.current > 0.5) {
        g.rotation.x = 0
        applyShoulderPose(vrm, steer.current, dt)
      } else if (tackle.current.active) {
        // タックル：頭から突っ込む
        applyFlyPose(vrm, dt)
        g.rotation.x = 0.7
      } else {
        g.rotation.x = 0
        runRatio.current += (moving - runRatio.current) * Math.min(1, 10 * dt)
        if (runRatio.current > 0.02) phase.current += (dt / BRO.stepPeriod) * Math.PI * 2 * Math.max(0.5, runRatio.current)
        applyWalk(vrm, phase.current, runRatio.current, BRO.walk, modelHeight)
        if (punchT.current > 0) applyPunchPose(vrm, 1 - punchT.current / 0.35)
      }
      vrm.update(dt)
    }
  })

  return (
    <group ref={group} position={[IMOUTO.spawn.x, 0, IMOUTO.spawn.z + 60]}>
      {vrm && <primitive object={vrm.scene} scale={scale} />}
    </group>
  )
}
