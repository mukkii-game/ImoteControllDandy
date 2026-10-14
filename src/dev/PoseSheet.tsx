import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm'
import { loadVRM } from '../systems/loaders'
import { MODEL_CHOICES, POSE_SHEET } from '../config/game'

/**
 * 開発用：?posesheet&who=imouto|bro&mode=openpose|depth|shade|sil
 * 今の VRM を A ポーズにして、正面・横・後ろを 1 枚に並べた「三面図の下敷き」を描く。
 * ComfyUI の ControlNet（OpenPose / Depth）に入れて設定画を生成するためのもの（docs/PIPELINE_ART.md）。
 * 書き出しは tools/pose_sheets.mjs（Playwright で各モードを撮る）
 */

type View = { name: 'front' | 'side' | 'back'; dir: THREE.Vector3 }

const S = POSE_SHEET

function params() {
  const q = new URLSearchParams(location.search)
  return { who: q.get('who') === 'bro' ? 'bro' : 'imouto', mode: q.get('mode') ?? 'openpose' }
}

function applyChoice(vrm: VRM, who: string) {
  const choice = who === 'bro' ? MODEL_CHOICES.bro.find((c) => c.id === 'seed-san') : MODEL_CHOICES.imouto[0]
  const hide = choice?.hideMaterials ?? []
  const tints = choice?.tintMaterials ?? []
  const tint = new THREE.Color(choice?.tintColor ?? '#ffffff')
  vrm.scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      const name = m.name ?? ''
      if (hide.some((k) => name.includes(k))) mesh.visible = false
      if (tints.some((k) => name.includes(k))) (m as THREE.Material & { color?: THREE.Color }).color?.copy(tint)
      // three-vrm の輪郭線（isOutline の材質）は下敷きでは消す
      if ((m as THREE.Material & { isOutline?: boolean }).isOutline) m.visible = false
    }
  })
}

function aPose(vrm: VRM, who: string) {
  const h = vrm.humanoid
  const world = (b: VRMHumanBoneName) => h.getRawBoneNode(b)?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3()
  // モデルによって骨の回転の向き（符号）が違うので、両方試して「先の骨が下へ（脚は外へ）行く方」を選ぶ
  const pick = (b: VRMHumanBoneName, tip: VRMHumanBoneName, ang: number, score: (root: THREE.Vector3, end: THREE.Vector3) => number) => {
    const n = h.getNormalizedBoneNode(b)
    if (!n) return
    let best = 0
    let bestScore = -Infinity
    for (const s of [1, -1]) {
      n.rotation.set(0, 0, s * ang)
      vrm.update(0)
      vrm.scene.updateMatrixWorld(true)
      const sc = score(world(b), world(tip))
      if (sc > bestScore) {
        bestScore = sc
        best = s
      }
    }
    n.rotation.set(0, 0, best * ang)
    vrm.update(0)
  }
  const down = (r: THREE.Vector3, e: THREE.Vector3) => r.y - e.y
  pick('leftUpperArm', 'leftHand', S.armDown, down)
  pick('rightUpperArm', 'rightHand', S.armDown, down)
  // 脚は足先が体の中心から外へ（左は +X、右は -X）
  pick('leftUpperLeg', 'leftFoot', S.legOut, (_r, e) => e.x)
  pick('rightUpperLeg', 'rightFoot', S.legOut, (_r, e) => -e.x)
  // 髪揺れ（スプリングボーン）を落ち着かせる
  for (let i = 0; i < 30; i++) vrm.update(1 / 30)
  const head = h.getRawBoneNode('head')
  head?.scale.setScalar(S.headScale[who] ?? 1)
  vrm.scene.updateMatrixWorld(true)
}

/** OpenPose（COCO 18 点）の点と色。controlnet_aux と同じ並び */
const LIMBS = [
  [1, 2], [1, 5], [2, 3], [3, 4], [5, 6], [6, 7], [1, 8], [8, 9], [9, 10], [1, 11], [11, 12], [12, 13], [1, 0], [0, 14], [14, 16], [0, 15], [15, 17],
]
const COLORS = [
  [255, 0, 0], [255, 85, 0], [255, 170, 0], [255, 255, 0], [170, 255, 0], [85, 255, 0], [0, 255, 0], [0, 255, 85], [0, 255, 170],
  [0, 255, 255], [0, 170, 255], [0, 85, 255], [0, 0, 255], [85, 0, 255], [170, 0, 255], [255, 0, 255], [255, 0, 170], [255, 0, 85],
]

function keypoints(vrm: VRM, headK: number): (THREE.Vector3 | null)[] {
  const h = vrm.humanoid
  const p = (b: VRMHumanBoneName) => {
    const n = h.getRawBoneNode(b)
    return n ? n.getWorldPosition(new THREE.Vector3()) : null
  }
  const head = p('head')!
  const f = S.face
  const k = headK
  const at = (x: number, y: number, z: number) => head.clone().add(new THREE.Vector3(x * k, y * k, z * k))
  const ls = p('leftUpperArm')
  const rs = p('rightUpperArm')
  const neck = ls && rs ? ls.clone().add(rs).multiplyScalar(0.5) : p('neck')
  // モデルは +Z が正面、+X が本人の左
  return [
    at(0, f.noseUp, f.noseForward), // 0 鼻
    neck, // 1 首
    rs, p('rightLowerArm'), p('rightHand'), // 2-4 右腕
    ls, p('leftLowerArm'), p('leftHand'), // 5-7 左腕
    p('rightUpperLeg'), p('rightLowerLeg'), p('rightFoot'), // 8-10 右脚
    p('leftUpperLeg'), p('leftLowerLeg'), p('leftFoot'), // 11-13 左脚
    at(-f.eyeSide, f.eyeUp, f.eyeForward), // 14 右目
    at(f.eyeSide, f.eyeUp, f.eyeForward), // 15 左目
    at(-f.earSide, f.eyeUp * 0.6, 0), // 16 右耳
    at(f.earSide, f.eyeUp * 0.6, 0), // 17 左耳
  ]
}

/** 見えない顔の点を外す（後ろ向きは鼻・目なし、横向きは向こう側の目・耳なし） */
function visible(view: View['name'], i: number): boolean {
  if (view === 'back') return !(i === 0 || i === 14 || i === 15)
  if (view === 'side') {
    // sideFacing=1：右を向く＝本人の左側が見える… カメラは本人の右側（-X）か左側（+X）
    const seeLeft = S.sideFacing < 0
    if (seeLeft) return !(i === 14 || i === 16)
    return !(i === 15 || i === 17)
  }
  return true
}

export function PoseSheet() {
  const glRef = useRef<HTMLCanvasElement>(null)
  const poseRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const { who, mode } = params()
    const W = S.width
    const H = S.height
    const renderer = new THREE.WebGLRenderer({ canvas: glRef.current!, antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(1)
    renderer.setSize(W, H, false)
    renderer.setScissorTest(true)
    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight('#ffffff', 1.6))
    const sun = new THREE.DirectionalLight('#ffffff', 1.6)
    sun.position.set(1, 2, 3)
    scene.add(sun)
    let alive = true
    const url = who === 'bro' ? 'models/Seed-san.vrm' : MODEL_CHOICES.imouto[0].url

    loadVRM(url).then((vrm) => {
      if (!alive) return
      applyChoice(vrm, who)
      aPose(vrm, who)
      scene.add(vrm.scene)
      // 見えている部品だけで枠を決める（非表示にしたロボットの部品などを含めない）
      const box = new THREE.Box3()
      vrm.scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        let vis = true
        for (let q: THREE.Object3D | null = m; q; q = q.parent) if (!q.visible) vis = false
        const mats = Array.isArray(m.material) ? m.material : [m.material]
        if (vis && mats.some((mm) => mm.visible)) box.expandByObject(m, true)
      })
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      const cellW = W / 3
      // 高さと横幅（腕を広げた幅）の両方が 1 マスに収まる大きさ
      const viewH = Math.max(size.y, Math.max(size.x, size.z) * (H / cellW)) / (1 - S.margin * 2)
      const views: View[] = [
        { name: 'front', dir: new THREE.Vector3(0, 0, 1) },
        { name: 'side', dir: new THREE.Vector3(S.sideFacing > 0 ? -1 : 1, 0, 0) },
        { name: 'back', dir: new THREE.Vector3(0, 0, -1) },
      ]
      const depthMat = new THREE.MeshDepthMaterial()
      const silMat = new THREE.MeshBasicMaterial({ color: '#000000' })
      const bg = mode === 'depth' || mode === 'openpose' ? '#000000' : '#ffffff'
      renderer.setClearColor(bg)
      scene.overrideMaterial = mode === 'depth' ? depthMat : mode === 'sil' ? silMat : null

      const ctx = poseRef.current!.getContext('2d')!
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)
      const kps = keypoints(vrm, S.headScale[who] ?? 1)

      views.forEach((v, vi) => {
        const aspect = cellW / H
        const cam = new THREE.OrthographicCamera((-viewH * aspect) / 2, (viewH * aspect) / 2, viewH / 2, -viewH / 2, 0.01, 10)
        // 奥行きは見ている方向の体の厚みだけに絞る（手前が白、奥が黒。濃淡がはっきり出る）
        const half = Math.abs(v.dir.x) > 0.5 ? size.x / 2 : size.z / 2
        const dist = Math.max(size.x, size.z) + 1
        cam.position.copy(center).addScaledVector(v.dir, dist)
        cam.lookAt(center)
        cam.near = dist - half - 0.02
        cam.far = dist + half + 0.02
        cam.updateProjectionMatrix()
        renderer.setViewport(vi * cellW, 0, cellW, H)
        renderer.setScissor(vi * cellW, 0, cellW, H)
        renderer.render(scene, cam)

        // OpenPose：点を画面へ投影して 2D に描く
        const pts = kps.map((k, i) => {
          if (!k || !visible(v.name, i)) return null
          const q = k.clone().project(cam)
          return [vi * cellW + (q.x * 0.5 + 0.5) * cellW, (-q.y * 0.5 + 0.5) * H]
        })
        ctx.lineCap = 'round'
        LIMBS.forEach(([a, b], li) => {
          const pa = pts[a]
          const pb = pts[b]
          if (!pa || !pb) return
          const c = COLORS[li]
          ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${S.openpose.alpha})`
          ctx.lineWidth = S.openpose.stick
          ctx.beginPath()
          ctx.moveTo(pa[0], pa[1])
          ctx.lineTo(pb[0], pb[1])
          ctx.stroke()
        })
        pts.forEach((pt, i) => {
          if (!pt) return
          const c = COLORS[i]
          ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`
          ctx.beginPath()
          ctx.arc(pt[0], pt[1], S.openpose.dot, 0, Math.PI * 2)
          ctx.fill()
        })
      })
      ;(window as unknown as { __pose: object }).__pose = { ready: true, who, mode, height: +size.y.toFixed(3) }
    })
    return () => {
      alive = false
      renderer.dispose()
    }
  }, [])

  const { mode } = params()
  const st = { width: S.width, height: S.height, display: 'block' } as const
  return (
    <div style={{ background: '#222', minHeight: '100vh' }}>
      <canvas id="gl" ref={glRef} width={S.width} height={S.height} style={{ ...st, display: mode === 'openpose' ? 'none' : 'block' }} />
      <canvas id="pose" ref={poseRef} width={S.width} height={S.height} style={{ ...st, display: mode === 'openpose' ? 'block' : 'none' }} />
    </div>
  )
}
