import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { IMOUTO, MODELS, SCALE } from '../config/game'
import { useVRM } from '../systems/loaders'
import { refs } from '../systems/refs'
import { useGame } from '../systems/store'
import { readMove } from '../systems/input'
import { emit } from '../systems/events'
import { applyWalk, applyFace } from '../systems/procAnim'

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
  const vrm = useVRM(MODELS.imouto)
  const speed = useRef(0)
  const phase = useRef(0)
  const lastStepSide = useRef(0)
  const probeTimer = useRef(0)
  const clock = useRef(0)
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
      if (mats.some((mm) => /hair/i.test(mm.name ?? ''))) return
      targets.push(m)
    })
    probeTargets.current = targets
    // スプリングボーン（髪）の力は世界座標で効くので、巨大化した分だけ強くしないと動きが鈍い
    const sb = vrm.springBoneManager
    if (sb) {
      for (const j of sb.joints) {
        j.settings.stiffness *= scale * IMOUTO.hairStiffnessScale
        j.settings.gravityPower *= scale * IMOUTO.hairGravityScale
        j.settings.dragForce = IMOUTO.hairDrag
      }
    }
    warmedUp.current = false
    setLoaded('imouto')
    return () => {
      anchor.removeFromParent()
    }
  }, [vrm, setLoaded])

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

    g.rotation.y -= m.x * IMOUTO.turnSpeed * dt
    const targetSpeed = Math.max(0, m.y) * IMOUTO.walkSpeed
    speed.current += (targetSpeed - speed.current) * Math.min(1, IMOUTO.accel * dt)
    g.position.x += Math.sin(g.rotation.y) * speed.current * dt
    g.position.z += Math.cos(g.rotation.y) * speed.current * dt

    const walkRatio = speed.current / IMOUTO.walkSpeed
    if (walkRatio > 0.02) phase.current += (dt / IMOUTO.stepPeriod) * Math.PI * 2 * Math.max(0.4, walkRatio)
    applyWalk(vrm, phase.current, walkRatio, IMOUTO.walk, modelHeight)
    clock.current += dt
    applyFace(vrm, clock.current, walkRatio, IMOUTO.face)

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
      const hits = raycaster.intersectObjects(probeTargets.current, false)
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
