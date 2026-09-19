// Esc で開く調整パネルの項目。path は game.ts のオブジェクトのドット区切り。
import { SCALE, BRO, IMOUTO, CAMERA, LOCKON } from './game'

export interface TuneItem {
  path: string
  label: string
  min: number
  max: number
  step: number
}

export const TUNE_GROUPS: { title: string; items: TuneItem[] }[] = [
  {
    title: 'サイズ',
    items: [
      { path: 'SCALE.imoutoHeight', label: '妹の身長 m', min: 10, max: 150, step: 1 },
      { path: 'SCALE.broHeight', label: '兄の身長 m', min: 1, max: 10, step: 0.1 },
    ],
  },
  {
    title: '妹の歩き',
    items: [
      { path: 'IMOUTO.walkSpeed', label: '歩行速度 m/s', min: 2, max: 60, step: 1 },
      { path: 'IMOUTO.stepPeriod', label: '1歩の秒数', min: 0.3, max: 3, step: 0.05 },
      { path: 'IMOUTO.turnSpeed', label: '旋回速度', min: 0.1, max: 2, step: 0.05 },
      { path: 'IMOUTO.walk.legSwing', label: '脚の振り', min: 0, max: 1.5, step: 0.05 },
      { path: 'IMOUTO.walk.kneeBend', label: '膝の曲げ', min: 0, max: 1.5, step: 0.05 },
      { path: 'IMOUTO.walk.armSwing', label: '腕の振り', min: 0, max: 2.5, step: 0.05 },
      { path: 'IMOUTO.walk.armDown', label: '腕の下ろし', min: 0.5, max: 1.6, step: 0.05 },
      { path: 'IMOUTO.walk.bodyBob', label: '上下バウンド', min: 0, max: 0.05, step: 0.002 },
      { path: 'IMOUTO.stepShake', label: '着地の揺れ', min: 0, max: 3, step: 0.1 },
    ],
  },
  {
    title: '髪の物理（変更後は再読み込み）',
    items: [
      { path: 'IMOUTO.hairStiffnessScale', label: '硬さ', min: 0.1, max: 5, step: 0.1 },
      { path: 'IMOUTO.hairGravityScale', label: '重力', min: 0, max: 5, step: 0.1 },
      { path: 'IMOUTO.hairDrag', label: '抵抗', min: 0, max: 1, step: 0.05 },
      { path: 'IMOUTO.broHairColliderRadius', label: '兄の髪よけ半径 m', min: 0, max: 8, step: 0.1 },
    ],
  },
  {
    title: '妹の表情',
    items: [
      { path: 'IMOUTO.face.happy', label: '笑顔（目）', min: 0, max: 1, step: 0.05 },
      { path: 'IMOUTO.face.mouthOpen', label: '口の開き', min: 0, max: 1, step: 0.05 },
      { path: 'IMOUTO.face.mouthOpenWalk', label: '口の開き（歩行中）', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    title: '肩の位置',
    items: [
      { path: 'IMOUTO.shoulderProbe.inward', label: '首寄り', min: -0.03, max: 0.05, step: 0.001 },
      { path: 'IMOUTO.shoulderProbe.up', label: '探索の高さ', min: 0.02, max: 0.2, step: 0.005 },
      { path: 'IMOUTO.broSeat.forward', label: '兄 前後 m', min: -6, max: 6, step: 0.1 },
      { path: 'IMOUTO.broSeat.outward', label: '兄 内外 m', min: -6, max: 6, step: 0.1 },
      { path: 'IMOUTO.broSeat.up', label: '兄 上下 m', min: -4, max: 4, step: 0.1 },
    ],
  },
  {
    title: '兄',
    items: [
      { path: 'BRO.runSpeed', label: '走る速さ', min: 2, max: 30, step: 0.5 },
      { path: 'BRO.jumpVelocity', label: 'ジャンプ力', min: 3, max: 30, step: 0.5 },
      { path: 'BRO.gravity', label: '重力', min: 5, max: 60, step: 1 },
      { path: 'BRO.mountArc', label: '飛び乗りの弧', min: 0, max: 0.6, step: 0.02 },
    ],
  },
  {
    title: 'ロックオン投擲',
    items: [
      { path: 'LOCKON.maxLocks', label: '最大ロック数', min: 1, max: 12, step: 1 },
      { path: 'LOCKON.reticleRadius', label: 'サイト半径', min: 0.02, max: 0.3, step: 0.01 },
      { path: 'LOCKON.flySpeed', label: '飛行速度', min: 60, max: 600, step: 10 },
      { path: 'LOCKON.windupSec', label: '振りかぶり秒', min: 0, max: 1.5, step: 0.05 },
      { path: 'LOCKON.returnSec', label: '帰還秒', min: 0.3, max: 3, step: 0.1 },
      { path: 'LOCKON.explosionRadius', label: '爆発の大きさ', min: 4, max: 40, step: 1 },
      { path: 'CAMERA.thrown.fov', label: '投擲 FOV', min: 40, max: 100, step: 1 },
      { path: 'CAMERA.thrown.broWeight', label: '投擲 兄寄り', min: 0, max: 1, step: 0.05 },
      { path: 'CAMERA.thrown.distanceK', label: '投擲 引き係数', min: 0.1, max: 1.5, step: 0.05 },
    ],
  },
  {
    title: 'カメラ',
    items: [
      { path: 'CAMERA.ground.fov', label: '地上 FOV', min: 40, max: 110, step: 1 },
      { path: 'CAMERA.ground.distance', label: '地上 距離', min: 1, max: 15, step: 0.25 },
      { path: 'CAMERA.ground.targetHeight', label: '地上 注視高さ', min: 0, max: 5, step: 0.1 },
      { path: 'CAMERA.shoulder.fov', label: '肩上 FOV', min: 30, max: 100, step: 1 },
      { path: 'CAMERA.shoulder.distance', label: '肩上 距離', min: 5, max: 120, step: 1 },
      { path: 'CAMERA.shoulder.targetHeight', label: '肩上 注視高さ', min: -20, max: 20, step: 0.5 },
      { path: 'CAMERA.mouseSensitivity', label: 'マウス感度', min: 0.0005, max: 0.01, step: 0.0005 },
      { path: 'CAMERA.shakeAmp', label: '揺れの大きさ', min: 0, max: 2, step: 0.05 },
    ],
  },
]

const ROOTS: Record<string, Record<string, unknown>> = { SCALE, BRO, IMOUTO, CAMERA, LOCKON }
const STORAGE_KEY = 'imouto-tuning-v1'

function resolve(path: string): { obj: Record<string, unknown>; key: string } {
  const parts = path.split('.')
  let obj: Record<string, unknown> = ROOTS[parts[0]]
  for (let i = 1; i < parts.length - 1; i++) obj = obj[parts[i]] as Record<string, unknown>
  return { obj, key: parts[parts.length - 1] }
}

export function getTune(path: string): number {
  const { obj, key } = resolve(path)
  return obj[key] as number
}

export function setTune(path: string, value: number) {
  const { obj, key } = resolve(path)
  obj[key] = value
}

const defaults = new Map<string, number>()
for (const g of TUNE_GROUPS) for (const it of g.items) defaults.set(it.path, getTune(it.path))

export function resetTune() {
  for (const [p, v] of defaults) setTune(p, v)
  localStorage.removeItem(STORAGE_KEY)
}

/** 既定値から変えた項目だけ */
export function diffTune(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [p, v] of defaults) {
    const cur = getTune(p)
    if (Math.abs(cur - v) > 1e-9) out[p] = cur
  }
  return out
}

export function saveTune() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(diffTune()))
  } catch {
    /* ignore */
  }
}

export function loadTune() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const obj = JSON.parse(raw) as Record<string, number>
    for (const [p, v] of Object.entries(obj)) if (defaults.has(p) && typeof v === 'number') setTune(p, v)
  } catch {
    /* ignore */
  }
}
