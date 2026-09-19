import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { IMOUTO, SCALE, CAMERA, SPEECH, LOCKON } from '../config/game'
import { makeSilhouette, type Silhouette } from '../systems/silhouette'
import { useModels, candidates } from '../systems/models'
import { useVRM } from '../systems/loaders'
import { VRMSpringBoneCollider, VRMSpringBoneColliderShapeSphere } from '@pixiv/three-vrm'
import { refs } from '../systems/refs'
import { useGame } from '../systems/store'
import { readMove } from '../systems/input'
import { emit, on } from '../systems/events'
import { HIT } from '../config/waves'
import { applyWalk, applyFace, applySkillPose, applySkillFace, applySitPose, armSign as armSignOf } from '../systems/procAnim'

const smooth = (t: number) => { const k = THREE.MathUtils.clamp(t, 0, 1); return k * k * (3 - 2 * k) }
/** 右手の指の骨（握る用） */
const RIGHT_FINGERS = [
  'rightIndexProximal', 'rightIndexIntermediate', 'rightIndexDistal',
  'rightMiddleProximal', 'rightMiddleIntermediate', 'rightMiddleDistal',
  'rightRingProximal', 'rightRingIntermediate', 'rightRingDistal',
  'rightLittleProximal', 'rightLittleIntermediate', 'rightLittleDistal',
  'rightThumbProximal', 'rightThumbDistal',
] as const
import { GAME } from '../config/game'
import { SkillRunner } from '../systems/skills'
import { SKILLS, type SkillId } from '../config/skills'
import { useInput } from '../systems/input'
import { applyLogo } from '../systems/logo'

const raycaster = new THREE.Raycaster()
const DOWN = new THREE.Vector3(0, -1, 0)
const probeOrigin = new THREE.Vector3()
const boneWorld = new THREE.Vector3()
const headWorld = new THREE.Vector3()
const inward = new THREE.Vector3()

/**
 * 妹。VRM を身長 60m にスケール。歩行は手続きアニメ。
 * 肩上モードのとき WASD でリモコン操作（前進／旋回）。地上モードでは立ち止まる。
 */
export function Imouto() {
  const group = useRef<THREE.Group>(null!)
  const selected = useModels((s) => s.imouto)
  const setResolved = useModels((s) => s.setResolved)
  const { vrm, choice } = useVRM(candidates('imouto', selected))
  const speed = useRef(0)
  const phase = useRef(0)
  const lastStepSide = useRef(0)
  const probeTimer = useRef(0)
  const clock = useRef(0)
  const hitTimer = useRef(0)
  /** 射撃モードの消え具合（0=表示、1=消えている） */
  const fadeK = useRef(0)
  const silhouette = useRef<Silhouette | null>(null)
  const skills = useRef(new SkillRunner())
  /** 吹き出しの後に発動する技 */
  const pendingSkill = useRef<{ id: SkillId; t: number } | null>(null)
  const titleSayT = useRef(1.2)
  const titleSayI = useRef(0)
  const throwK = useRef(-1)
  /** 右腕の上書きの重み（0=歩きのまま、1=掴み／投げポーズ） */
  const armW = useRef(0)
  const sitK = useRef(0)
  const anchorRef = useRef<THREE.Object3D | null>(null)
  const boneRef = useRef<THREE.Object3D | null>(null)
  const chestRef = useRef<THREE.Object3D | null>(null)
  const anchorTarget = useRef<THREE.Vector3 | null>(null)
  const probeTargets = useRef<THREE.Object3D[]>([])
  const warmedUp = useRef(false)
  const setLoaded = useGame((s) => s.setLoaded)
  const tuneVersion = useGame((s) => s.tuneVersion)

  const modelHeight = useMemo(() => {
    if (!vrm) return 1
    const box = new THREE.Box3().setFromObject(vrm.scene)
    return box.max.y - box.min.y
  }, [vrm])
  const scale = SCALE.imoutoHeight / modelHeight
  void tuneVersion

  useEffect(() => {
    refs.imouto = group.current
    return () => {
      refs.imouto = null
      refs.shoulder = null
      refs.head = null
    }
  }, [])

  useEffect(() => {
    if (!vrm) return
    // VRM は +X が左。カメラを置く側（+X）に合わせて左肩に乗せる。upperArm が肩関節の位置
    // アンカーは腕の振りに影響されない「胸」ボーンの子にする。上腕ボーンはレイの基準位置にだけ使う
    const bone = vrm.humanoid.getNormalizedBoneNode('leftUpperArm')
    const chest = vrm.humanoid.getNormalizedBoneNode('upperChest') ?? vrm.humanoid.getNormalizedBoneNode('chest') ?? vrm.humanoid.getNormalizedBoneNode('spine')
    const anchor = new THREE.Object3D()
    chest?.add(anchor)
    if (bone && chest) {
      // 初期値：肩関節の位置
      bone.getWorldPosition(anchor.position)
      chest.worldToLocal(anchor.position)
    }
    refs.shoulder = anchor
    anchorRef.current = anchor
    boneRef.current = bone ?? null
    chestRef.current = chest ?? null
    anchorTarget.current = null
    refs.head = vrm.humanoid.getNormalizedBoneNode('head')
    refs.rightHand = vrm.humanoid.getRawBoneNode('rightHand')
    refs.rightFinger = vrm.humanoid.getRawBoneNode('rightMiddleProximal')
    refs.palmRatio = LOCKON.grab.palmRatio
    // 肩レイキャストは髪を除いた体だけ（髪は高ポリで重い）
    const targets: THREE.Object3D[] = []
    vrm.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      if (mats.some((mm) => (choice?.hideMaterials ?? []).some((k) => (mm.name ?? '').includes(k)))) m.visible = false
      // 髪・顔は対象外（子ども体型だと頬に当たって耳の位置に乗ってしまう）
      if (mats.some((mm) => /hair|face|eye|brow|mouth/i.test(mm.name ?? ''))) return
      if (/face|hair/i.test(m.name)) return
      targets.push(m)
    })
    probeTargets.current = targets
    applyLogo(vrm)
    // スプリングボーン（髪）の力は世界座標で効くので、巨大化した分だけ強くしないと動きが鈍い
    const sb = vrm.springBoneManager
    if (sb) {
      // 兄の立ち位置に球コライダーを置き、髪の房が兄を避けて垂れるようにする（アンカーの子＝肩表面に追従）
      const r = IMOUTO.broHairColliderRadius / scale
      const collider = new VRMSpringBoneCollider(new VRMSpringBoneColliderShapeSphere({ radius: r, offset: new THREE.Vector3(0, IMOUTO.broHairColliderUp / scale, 0) }))
      anchor.add(collider)
      const group = { name: 'bro', colliders: [collider] }
      for (const j of sb.joints) {
        j.settings.stiffness *= scale * IMOUTO.hairStiffnessScale
        j.settings.gravityPower *= scale * IMOUTO.hairGravityScale
        j.settings.dragForce = IMOUTO.hairDrag
        if (r > 0) j.colliderGroups.push(group)
        sb.addJoint(j) // 依存関係（コライダー）の並び替えを促す
      }
    }
    warmedUp.current = false
    setLoaded('imouto')
    if (choice) setResolved('imouto', choice)
    return () => {
      anchor.removeFromParent()
    }
  }, [vrm, choice, setLoaded, setResolved, scale])

  useEffect(() => on('imouto.hit', () => { hitTimer.current = HIT.faceSec; slowTimer.current = HIT.slowSec }), [])
  /** 被弾の減速（SPEC：0.5 秒減速）。残り秒数 */
  const slowTimer = useRef(0)
  useEffect(() => on('bro.throw', ({ from }) => { if (from === 'shoulder') throwK.current = 0 }), [])

  useFrame((_, dt) => {
    if (!vrm) return
    const g = group.current
    if (!warmedUp.current) {
      // 初回：髪が T ポーズ位置から落ちきるまで待たされないよう、先に何秒分か回しておく
      warmedUp.current = true
      g.updateMatrixWorld(true)
      vrm.springBoneManager?.reset()
      for (let i = 0; i < IMOUTO.hairWarmupSteps; i++) vrm.update(1 / 30)
    }
    const game = useGame.getState()
    const mode = game.mode
    const playing = game.phase === 'play'
    const m = mode === 'shoulder' && playing ? readMove() : { x: 0, y: 0 }
    // 射撃モード（肩上で溜め中）：一瞬で同じ色のシルエットになりながら消える。離すと元に戻る
    {
      const throwing = CAMERA.aim.hideDuringThrow && mode === 'thrown' && game.attackFrom === 'shoulder'
      const want = CAMERA.aim.vanish && ((game.charging && mode === 'shoulder') || throwing)
      // 消えるときは fadeSec、戻るときは showFadeSec の短いフェード
      fadeK.current = THREE.MathUtils.clamp(fadeK.current + (want ? dt / CAMERA.aim.fadeSec : -dt / CAMERA.aim.showFadeSec), 0, 1)
      if (!silhouette.current) silhouette.current = makeSilhouette(vrm.scene, CAMERA.aim.silhouetteColor)
      silhouette.current.blend(fadeK.current, CAMERA.aim.silhouetteOpacity)
    }
    // 技の入力（肩上のみ）
    const inp = useInput.getState()
    // 技の指示：兄の吹き出し（＋声）が先に出て、SPEECH.skillDelaySec 後に発動
    const order = (id: SkillId) => {
      if (pendingSkill.current || !skills.current.canUse(id)) return
      pendingSkill.current = { id, t: 0 }
      emit('bro.say', { text: SPEECH.lines[id], key: id })
    }
    if (mode === 'shoulder' && playing) {
      for (const id of ['skip', 'shoe', 'cry'] as SkillId[]) {
        const key = SKILLS[id].key
        const action = (`skill${key}`) as 'skill1' | 'skill2' | 'skill3'
        if (inp.consume(action)) order(id)
      }
      if (inp.consume('skillFire')) order((['skip', 'shoe', 'cry'] as SkillId[])[inp.skillSel])
    }
    if (pendingSkill.current) {
      pendingSkill.current.t += dt
      if (pendingSkill.current.t >= SPEECH.skillDelaySec) {
        skills.current.start(pendingSkill.current.id, g.position, g.rotation.y)
        pendingSkill.current = null
      }
    }
    // タイトル：眠そうなセリフを順番に
    if (game.phase === 'title') {
      titleSayT.current -= dt
      if (titleSayT.current <= 0) {
        titleSayT.current = SPEECH.imouto.titleEverySec
        const lines = SPEECH.imouto.title
        const i = titleSayI.current % lines.length
        titleSayI.current++
        emit('imouto.say', { text: lines[i], key: i === 0 ? 'yawn' : 'sleepy' })
      }
    } else titleSayT.current = 0.5
    skills.current.tick(dt, g.position)
    const sk = skills.current.active
    const skT = skills.current.t

    g.rotation.y -= m.x * IMOUTO.turnSpeed * dt
    // 兄の行き先指示：A D を触っていない間はそちらへ旋回。近づいたら解除
    // プロト：指示が無くても自動で学校（GAME.dest）へ向かう
    const wp = game.waypoint ?? (GAME.dest.autoNavigate ? GAME.dest : null)
    if (wp && playing) {
      const dx = wp.x - g.position.x
      const dz = wp.z - g.position.z
      if (Math.hypot(dx, dz) < GAME.dest.arriveDist) {
        if (game.waypoint) game.setWaypoint(null)
      } else if (Math.abs(m.x) < 0.2) {
        let diff = Math.atan2(dx, dz) - g.rotation.y
        diff = Math.atan2(Math.sin(diff), Math.cos(diff))
        const step = IMOUTO.turnSpeed * dt
        g.rotation.y += Math.abs(diff) < step ? diff : Math.sign(diff) * step
      }
    }
    hitTimer.current = Math.max(0, hitTimer.current - dt)
    slowTimer.current = Math.max(0, slowTimer.current - dt)
    let speedMul = 1
    if (sk === 'skip') speedMul = SKILLS.skip.speedMul
    if (sk === 'shoe' || sk === 'cry') speedMul = 0
    // 被弾中は減速（よろけ）
    if (slowTimer.current > 0) speedMul *= HIT.slowFactor
    // 自動歩行：常に前進。W で加速、S で減速。兄は方向だけ変える
    const drive = playing ? (m.y > 0.2 ? IMOUTO.boostMul : m.y < -0.2 ? IMOUTO.slowMul : 1) : 0
    const targetSpeed = (sk === 'skip' ? 1 : drive) * IMOUTO.walkSpeed * speedMul
    speed.current += (targetSpeed - speed.current) * Math.min(1, IMOUTO.accel * dt)
    g.position.x += Math.sin(g.rotation.y) * speed.current * dt
    g.position.z += Math.cos(g.rotation.y) * speed.current * dt

    const walkRatio = speed.current / IMOUTO.walkSpeed
    if (walkRatio > 0.02) phase.current += (dt / IMOUTO.stepPeriod) * Math.PI * 2 * Math.max(0.4, walkRatio)
    applyWalk(vrm, phase.current, walkRatio, IMOUTO.walk, modelHeight)
    clock.current += dt
    if (game.phase === 'title') {
      // タイトル：眠そうに目を閉じてあくび（4 秒周期）。頭を少し後ろへ
      const cyc = (clock.current % 4.5) / 4.5
      const yawn = cyc < 0.3 ? cyc / 0.3 : cyc < 0.6 ? 1 : cyc < 0.8 ? 1 - (cyc - 0.6) / 0.2 : 0
      const em = vrm.expressionManager
      em?.setValue('happy', 0)
      em?.setValue('sad', 0)
      em?.setValue('blink', 1)
      em?.setValue('aa', 0.15 + 0.75 * yawn)
      vrm.humanoid.getNormalizedBoneNode('head')?.rotation.set(-0.35 * yawn, 0, 0.08)
      vrm.humanoid.getNormalizedBoneNode('neck')?.rotation.set(-0.15 * yawn, 0, 0)
      // 片手を口元へ
      const g2 = armSignOf(vrm)
      vrm.humanoid.getNormalizedBoneNode('rightUpperArm')?.rotation.set(-1.7 * yawn * g2, -0.5 * yawn, 0.9 * g2)
      vrm.humanoid.getNormalizedBoneNode('rightLowerArm')?.rotation.set(0, 2.4 * yawn * g2, 0.3 * g2)
    } else if (game.phase === 'clear') {
      // ED：校庭で体育座り、にっこり
      sitK.current = Math.min(1, sitK.current + dt / 1.2)
      applySitPose(vrm, sitK.current, modelHeight)
      applyFace(vrm, clock.current, 0, { ...IMOUTO.face, happy: 0.8, mouthOpen: 0.25 })
    } else if (game.phase === 'late') {
      // 遅刻：縮こまって泣きそう
      sitK.current = Math.min(1, sitK.current + dt / 1.2)
      applySitPose(vrm, sitK.current * 0.6, modelHeight)
      applySkillFace(vrm, 'cry', clock.current)
    } else if (sk) {
      applySkillPose(vrm, sk, skT, modelHeight)
      applySkillFace(vrm, sk, skT)
    } else if (playing && game.timeLeft > 0 && game.timeLeft < GAME.scaredSec && hitTimer.current <= 0) {
      // 残り1分：こわがる（眉が下がる sad を薄く、口を閉じ気味）
      applyFace(vrm, clock.current, walkRatio, { ...IMOUTO.face, happy: 0, mouthOpen: 0.15, mouthOpenWalk: 0.25 })
      vrm.expressionManager?.setValue('sad', 0.7)
    } else {
      vrm.expressionManager?.setValue('sad', 0)
      applyFace(vrm, clock.current, walkRatio, IMOUTO.face, hitTimer.current > 0)
    }
    // 右腕：掴み（ロックオン中は兄を右手に握って構える）→ 投げモーション → 戻る。歩きの腕の上から重みで上書き
    {
      const gr = LOCKON.grab
      const holding = game.charging && mode === 'shoulder'
      if (throwK.current >= 0) {
        throwK.current += dt / LOCKON.windupSec
        if (throwK.current >= 1) throwK.current = -1
      }
      const wantArm = holding || throwK.current >= 0
      armW.current = THREE.MathUtils.clamp(armW.current + (wantArm ? dt / gr.sec : -dt / gr.returnSec), 0, 1)
      if (armW.current > 0.001) {
        const g2 = armSignOf(vrm)
        let upper: number[]
        let lower: number[]
        if (throwK.current >= 0) {
          // 投げ：構え → 振りかぶり（windRatio まで）→ 一気に振り抜く
          const t = throwK.current
          const mix = (a: number[], b: number[], k: number) => a.map((v, i) => THREE.MathUtils.lerp(v, b[i], k))
          if (t < gr.windRatio) {
            const k = smooth(t / gr.windRatio)
            upper = mix(gr.hold.upper, gr.windBack.upper, k)
            lower = mix(gr.hold.lower, gr.windBack.lower, k)
          } else {
            const k = smooth((t - gr.windRatio) / (1 - gr.windRatio))
            upper = mix(gr.windBack.upper, gr.release.upper, k)
            lower = mix(gr.windBack.lower, gr.release.lower, k)
          }
        } else {
          upper = gr.hold.upper
          lower = gr.hold.lower
        }
        const w = smooth(armW.current)
        const ua = vrm.humanoid.getNormalizedBoneNode('rightUpperArm')
        const la = vrm.humanoid.getNormalizedBoneNode('rightLowerArm')
        if (ua) ua.rotation.set(THREE.MathUtils.lerp(ua.rotation.x, upper[0] * g2, w), THREE.MathUtils.lerp(ua.rotation.y, upper[1], w), THREE.MathUtils.lerp(ua.rotation.z, upper[2] * g2, w))
        if (la) la.rotation.set(THREE.MathUtils.lerp(la.rotation.x, lower[0], w), THREE.MathUtils.lerp(la.rotation.y, lower[1] * g2, w), THREE.MathUtils.lerp(la.rotation.z, lower[2] * g2, w))
        // 指を曲げて兄を握る（投げ切った瞬間は開く）
        const open = throwK.current >= gr.windRatio ? smooth((throwK.current - gr.windRatio) / (1 - gr.windRatio)) : 0
        const curl = gr.fingerCurl * w * (1 - open)
        for (const f of RIGHT_FINGERS) {
          const n = vrm.humanoid.getNormalizedBoneNode(f)
          if (n) n.rotation.z = curl * g2 * (f.startsWith('rightThumb') ? 0.4 : 1)
        }
      }
    }

    const side = Math.sign(Math.sin(phase.current))
    if (side !== 0 && side !== lastStepSide.current) {
      if (walkRatio > 0.3) emit('imouto.step', { strength: walkRatio * IMOUTO.stepShake, x: g.position.x, z: g.position.z })
      lastStepSide.current = side
    }
    vrm.update(dt)

    // 肩の表面をレイキャストで探し、アンカーをそこへ（兄がめり込まず・浮かず乗る）
    probeTimer.current -= dt
    if (probeTimer.current <= 0 && boneRef.current && anchorRef.current && refs.head) {
      probeTimer.current = IMOUTO.shoulderProbeInterval
      const bone = boneRef.current
      const H = SCALE.imoutoHeight
      const pr = IMOUTO.shoulderProbe
      bone.getWorldPosition(boneWorld)
      refs.head.getWorldPosition(headWorld)
      // 肩関節から頭へ向かう水平方向
      inward.subVectors(headWorld, boneWorld)
      inward.y = 0
      inward.normalize()
      probeOrigin.copy(boneWorld).addScaledVector(inward, pr.inward * H)
      probeOrigin.y += pr.up * H
      raycaster.set(probeOrigin, DOWN)
      raycaster.far = pr.far * H
      // 肩関節より少し上〜頭ボーンより下の範囲の当たりだけ採用
      const hits = raycaster
        .intersectObjects(probeTargets.current, false)
        .filter((h) => h.point.y < headWorld.y - IMOUTO.shoulderProbe.belowHead * H && h.point.y < boneWorld.y + IMOUTO.shoulderProbe.maxAbove * H)
      const target = hits.length > 0 ? hits[0].point.clone() : probeOrigin.clone().setY(boneWorld.y + IMOUTO.shoulderFallbackUp * H)
      // 手動オフセット（妹の向き基準）
      const seat = IMOUTO.broSeat
      const yaw = g.rotation.y
      target.x += Math.sin(yaw) * seat.forward - inward.x * seat.outward
      target.z += Math.cos(yaw) * seat.forward - inward.z * seat.outward
      target.y += seat.up
      chestRef.current?.worldToLocal(target)
      anchorTarget.current = target
    }
    // レイの結果へはスナップせず、なめらかに寄せる
    if (anchorTarget.current && anchorRef.current) {
      anchorRef.current.position.lerp(anchorTarget.current, Math.min(1, IMOUTO.shoulderFollowLerp * dt))
    }
  })

  return (
    <group ref={group} position={[IMOUTO.spawn.x, IMOUTO.spawn.y, IMOUTO.spawn.z]}>
      {vrm && <primitive object={vrm.scene} scale={scale} />}
    </group>
  )
}
