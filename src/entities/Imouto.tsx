import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { IMOUTO, SCALE } from '../config/game'
import { useModels, candidates } from '../systems/models'
import { useVRM } from '../systems/loaders'
import { VRMSpringBoneCollider, VRMSpringBoneColliderShapeSphere } from '@pixiv/three-vrm'
import { refs } from '../systems/refs'
import { useGame } from '../systems/store'
import { readMove } from '../systems/input'
import { emit, on } from '../systems/events'
import { HIT } from '../config/waves'
import { applyWalk, applyFace, applySkillPose, applySkillFace, applyThrowArm } from '../systems/procAnim'
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
  const skills = useRef(new SkillRunner())
  const throwK = useRef(-1)
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

  useEffect(() => on('imouto.hit', () => { hitTimer.current = HIT.slowSec }), [])
  useEffect(() => on('bro.throw', () => { throwK.current = 0 }), [])

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
    const mode = useGame.getState().mode
    const m = mode === 'shoulder' ? readMove() : { x: 0, y: 0 }
    // 技の入力（肩上のみ）
    const inp = useInput.getState()
    if (mode === 'shoulder') {
      for (const id of ['skip', 'shoe', 'cry'] as SkillId[]) {
        const key = SKILLS[id].key
        const action = (`skill${key}`) as 'skill1' | 'skill2' | 'skill3'
        if (inp.consume(action)) skills.current.start(id, g.position, g.rotation.y)
      }
    }
    skills.current.tick(dt, g.position)
    const sk = skills.current.active
    const skT = skills.current.t

    g.rotation.y -= m.x * IMOUTO.turnSpeed * dt
    hitTimer.current = Math.max(0, hitTimer.current - dt)
    let speedMul = hitTimer.current > 0 ? HIT.slowFactor : 1
    if (sk === 'skip') speedMul = SKILLS.skip.speedMul
    if (sk === 'shoe' || sk === 'cry') speedMul = 0
    const targetSpeed = (sk === 'skip' ? 1 : Math.max(0, m.y)) * IMOUTO.walkSpeed * speedMul
    speed.current += (targetSpeed - speed.current) * Math.min(1, IMOUTO.accel * dt)
    g.position.x += Math.sin(g.rotation.y) * speed.current * dt
    g.position.z += Math.cos(g.rotation.y) * speed.current * dt

    const walkRatio = speed.current / IMOUTO.walkSpeed
    if (walkRatio > 0.02) phase.current += (dt / IMOUTO.stepPeriod) * Math.PI * 2 * Math.max(0.4, walkRatio)
    applyWalk(vrm, phase.current, walkRatio, IMOUTO.walk, modelHeight)
    clock.current += dt
    if (sk) {
      applySkillPose(vrm, sk, skT, modelHeight)
      applySkillFace(vrm, sk, skT)
    } else {
      applyFace(vrm, clock.current, walkRatio, IMOUTO.face, hitTimer.current > 0)
    }
    // 投げる腕（兄の投擲開始から 0.6 秒）
    if (throwK.current >= 0) {
      throwK.current += dt / 0.6
      if (throwK.current >= 1) throwK.current = -1
      else applyThrowArm(vrm, throwK.current)
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
