// ゲーム全体の数値。バランス・スケール調整はここだけ触る（docs/SPEC.md が正）。
// ゲーム中は Esc の調整パネルからも書き換えられる（src/config/tuning.ts）。

export const SCALE = {
  /** 1ユニット = 1m */
  imoutoHeight: 60,
  broHeight: 3.6, // 見た目優先で2倍（仕様は1.8）
}

export interface ModelChoice {
  id: string
  label: string
  url: string
  /** クレジット表記（タイトル/README 用） */
  credit: string
  /** 非表示にするマテリアル名（部分一致） */
  hideMaterials?: readonly string[]
  /** 色替え（Seed-san 用） */
  tintMaterials?: readonly string[]
  tintColor?: string
}

/**
 * モデル候補。Esc の調整パネルから切り替え。ファイルが無ければ次の候補へ。
 * 追加するときは public/models/ に置いて、ここに1行足す。
 */
export const MODEL_CHOICES: { imouto: ModelChoice[]; bro: ModelChoice[] } = {
  imouto: [
    {
      id: 'vroid-default',
      label: 'VRoid デフォルト（ショート）',
      url: 'models/custom/imouto.vrm',
      credit: 'VRoid Hub モデル（作者名：要記入）',
    },
    {
      id: 'pixiv-sample',
      label: 'pixiv サンプル（ロング）',
      url: 'models/VRM1_Twist_Sample.vrm',
      credit: 'VRM1_Constraint_Twist_Sample (c) pixiv Inc.',
      hideMaterials: ['HairBack'],
    },
  ],
  bro: [
    {
      id: 'custom',
      label: 'カスタム（models/custom/bro.vrm）',
      url: 'models/custom/bro.vrm',
      credit: '',
    },
    {
      id: 'seed-san',
      label: 'Seed-san（学生服風に色替え）',
      url: 'models/Seed-san.vrm',
      credit: 'Seed-san by VirtualCast, Inc.',
      hideMaterials: ['backpack', 'anim_logo'],
      tintMaterials: ['huku', 'arm_mat', 'arm_plastic', 'armgear', 'wear_metal'],
      tintColor: '#1c2140',
    },
  ],
}

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
  /** 走りアニメの1歩の周期（秒） */
  stepPeriod: 0.42,
  walk: { legSwing: 0.9, kneeBend: 1.2, armSwing: 0.8, armDown: 1.2, bodyBob: 0.03, lean: 0.25, straightArms: false },
  /** マフラーの色 */
  scarfColor: '#e0312b',
}

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
  /** 手続きアニメ（ズシーン歩き） */
  /** 子どもの横断歩道歩き：腕をピンと伸ばして大きく前後、大股 */
  walk: { legSwing: 0.85, kneeBend: 0.35, armSwing: 1.0, armDown: 1.35, bodyBob: 0.02, lean: 0.04, straightArms: true },
  /** 表情：口を大きく開けた笑顔（happy＋aa）。歩行中は少し強める */
  face: { happy: 0.4, mouthOpen: 0.55, mouthOpenWalk: 0.8, blinkPeriod: 3.5 },
  /** 肩の表面をレイキャストで探す（身長比）。肩関節から頭方向へ inward、真上 up の点から下向きに撃つ */
  shoulderProbe: { inward: 0.012, up: 0.08, far: 0.2, belowHead: 0.01, maxAbove: 0.05 },
  /** レイが当たらない時の高さ（肩関節から、身長比） */
  shoulderFallbackUp: 0.025,
  shoulderProbeInterval: 0.2,
  /** アンカーがレイ結果へ寄る速さ */
  shoulderFollowLerp: 6,
  /** 兄の立ち位置の微調整（m、妹の向き基準）：forward=前、outward=肩先側、up=上 */
  broSeat: { forward: 0, outward: 0, up: 0 },
  /** 着地の揺れの強さ */
  stepShake: 1.0,
  /** 髪（スプリングボーン）：スケール補正に掛ける倍率と抵抗。ロード時のウォームアップ歩数 */
  hairStiffnessScale: 1.0,
  hairGravityScale: 1.0,
  hairDrag: 0.7,
  hairWarmupSteps: 120,
  /** 兄の周りに髪を避けさせる球コライダー（m）。0 で無効 */
  broHairColliderRadius: 6,
  broHairColliderUp: 2.5,
}

export const CAMERA = {
  near: 0.3,
  far: 1500,
  /** マウス感度（rad / px） */
  mouseSensitivity: 0.0025,
  touchSensitivity: 0.006,
  pitchMin: -0.35,
  pitchMax: 1.1,
  /** 地上：兄を中心にマウスで回すオービット。やや低めで妹が収まらない */
  ground: {
    fov: 78,
    distance: 4.5,
    /** 注視点の高さ（兄の腰〜胸） */
    targetHeight: 1.3,
    defaultPitch: 0.12,
  },
  /** 肩上：肩アンカーを中心にオービット。少し望遠 */
  shoulder: {
    fov: 55,
    distance: 34,
    /** 頭ボーンからの注視点オフセット（m） */
    targetHeight: 0,
    defaultPitch: 0.3,
  },
  /** 乗降中にカメラが体を突き抜けないよう外側に膨らませる距離(m) */
  transitionSideBulge: 30,
  followLerp: 7,
  /** シェイク減衰 */
  shakeDecay: 4.5,
  shakeAmp: 0.6,
}

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
}

export const DEBUG = {
  showStats: false,
}
