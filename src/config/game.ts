// ゲーム全体の数値。バランス・スケール調整はここだけ触る（docs/SPEC.md が正）。

export const SCALE = {
  /** 1ユニット = 1m */
  imoutoHeight: 60,
  broHeight: 1.8,
  broRadius: 0.4,
} as const

export const BRO = {
  walkSpeed: 8, // m/s（ヒーローなので速め）
  turnLerp: 12,
  /** 妹の足元この距離以内で乗れる（妹の足の中心から） */
  mountRadius: 14,
} as const

export const IMOUTO = {
  /** 出発位置（家の前） */
  spawn: { x: 0, y: 0, z: 0 },
  /** 妹ローカル座標（身長1として）での肩の位置。scale で 60m 化 */
  shoulderLocal: { x: 0.28, y: 0.82, z: 0 },
  /** 妹の色 */
  color: '#f2a6c2',
  hairColor: '#4a2a3a',
  skirtColor: '#3b4a8c',
} as const

export const CAMERA = {
  near: 0.5,
  far: 800,
  /** 地上：兄の背後、腰の高さ。妹が画面に収まらない迫力 */
  ground: {
    fov: 80,
    back: 4.5,
    height: 1.2,
    lookAhead: 6,
    lookHeight: 2.0,
  },
  /** 肩上：妹の肩後方から街を見下ろす。望遠っぽく狭め */
  shoulder: {
    fov: 55,
    back: 24,
    height: 7,
    side: 2,
    lookDownDistance: 80,
    lookDownDrop: 30,
  },
  /** 乗降時の1秒演出 */
  transitionSec: 1.0,
  /** 乗降中にカメラ／兄が妹の体を突き抜けないよう、外側に膨らませる距離(m) */
  transitionSideBulge: 30,
  broPathSideBulge: 14,
  /** 追従の滑らかさ（大きいほどキビキビ） */
  followLerp: 8,
} as const

export const STAGE = {
  roadWidth: 60, // 妹の足幅2〜3個分
  roadLength: 1200,
  buildingRows: 22,
  buildingSpacing: 50,
  groundColor: '#6b7f5a',
  roadColor: '#3a3a40',
} as const

export const DEBUG = {
  showStats: false,
} as const
