// ゲーム全体の数値。バランス・スケール調整はここだけ触る（docs/SPEC.md が正）。

export const SCALE = {
  /** 1ユニット = 1m */
  imoutoHeight: 60,
  broHeight: 1.8,
} as const

export const MODELS = {
  imouto: 'models/VRM1_Twist_Sample.vrm',
  bro: 'models/Xbot.glb',
} as const

export const BRO = {
  walkSpeed: 4,
  runSpeed: 11, // ヒーローなので速い
  turnLerp: 14,
  jumpVelocity: 9,
  gravity: 28,
  /** 肩へ飛び乗る演出の秒数（距離に応じて min〜max） */
  mountSecMin: 0.9,
  mountSecMax: 1.6,
  /** 飛び乗り時の放物線の高さ（妹の身長比） */
  mountArc: 0.25,
  /** 飛び降り：妹の前方どのくらいに着地するか（m） */
  dismountAhead: 22,
  dismountSide: 8,
  dismountSec: 1.1,
  /** マフラーの色 */
  scarfColor: '#e0312b',
  suitColor: '#1f7a5c',
  jointColor: '#111418',
} as const

export const IMOUTO = {
  spawn: { x: 0, y: 0, z: 0 },
  /** 歩行速度（m/s）。1歩で車数台分 */
  walkSpeed: 22,
  /** 1歩の周期（秒） */
  stepPeriod: 1.15,
  /** 旋回速度（rad/s） */
  turnSpeed: 0.55,
  /** 加減速のなめらかさ */
  accel: 1.4,
  /** 手続きアニメの振り幅（rad） */
  legSwing: 0.55,
  kneeBend: 0.5,
  armSwing: 0.35,
  bodyBob: 0.012, // 身長比
  /** 肩アンカー：右肩ボーンからのオフセット（モデルローカル、m） */
  shoulderOffset: { x: 0.12, y: 0.14, z: 0.04 },
  /** 着地の揺れの強さ */
  stepShake: 1.0,
} as const

export const CAMERA = {
  near: 0.3,
  far: 1500,
  /** 地上：兄の背後、やや低め。妹が画面に収まらない */
  ground: {
    fov: 78,
    back: 4.2,
    height: 1.4,
    lookAhead: 5,
    lookHeight: 1.6,
  },
  /** 肩上：妹の肩後方から街を見下ろす */
  shoulder: {
    fov: 55,
    back: 20,
    height: 9,
    side: 20,
    lookDownDistance: 80,
    lookDownDrop: 32,
  },
  /** 乗降中にカメラが体を突き抜けないよう外側に膨らませる距離(m) */
  transitionSideBulge: 30,
  followLerp: 7,
  /** シェイク減衰 */
  shakeDecay: 4.5,
  shakeAmp: 0.6,
} as const

export const STAGE = {
  /** 格子状の街。ブロック数（片側）。偶数にすると原点が交差点になる */
  blocks: 10,
  blockSize: 140,
  roadWidth: 34,
  groundColor: '#8aa06a',
  roadColor: '#4a4a52',
  sidewalkColor: '#9c9a90',
  /** ビル高さ範囲 */
  buildingMin: 8,
  buildingMax: 38,
  towerChance: 0.05,
  towerMax: 95,
} as const

export const DEBUG = {
  showStats: false,
} as const
