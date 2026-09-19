// ゲーム全体の数値。バランス・スケール調整はここだけ触る（docs/SPEC.md が正）。
// ゲーム中は Esc の調整パネルからも書き換えられる（src/config/tuning.ts）。

export const SCALE = {
  /** 1ユニット = 1m */
  imoutoHeight: 60,
  broHeight: 4.9, // 見た目優先（仕様は1.8）
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
      label: 'Seed-san（学生服風）',
      url: 'models/Seed-san.vrm',
      credit: 'Seed-san by VirtualCast, Inc.',
      hideMaterials: ['arm_mat', 'arm_plastic', 'armgear', 'robo_face', 'green_emit', 'glass', 'backpack', 'anim_logo', 'wear_metal'],
      tintMaterials: ['huku'],
      tintColor: '#14172a',
    },
  ],
}

export const BRO = {
  walkSpeed: 4,
  runSpeed: 10.5,
  turnLerp: 14,
  jumpVelocity: 9,
  /** 地上パンチ：この距離以内の敵を殴る（m）。ロックオン攻撃でもこの距離内はダッシュ打撃 */
  punchRange: 60,
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
  /** 肩上で操作中に指差しするか（false なら常に腕組み） */
  pointWhileSteering: false,
  /** 走りアニメの1歩の周期（秒） */
  stepPeriod: 0.5,
  walk: { legSwing: 0.75, kneeBend: 1.1, armSwing: 0.7, armDown: 1.2, bodyBob: 0.018, lean: 0.2, straightArms: false },
  /** マフラーの色 */
  scarfColor: '#e0312b',
}

export const IMOUTO = {
  name: 'ロロ',
  spawn: { x: 0, y: 0, z: -1540 },
  /**
   * 服のロゴ。Tops テクスチャに Canvas で描く（VRM ファイルは触らない）。
   * u/v は 0..1 のテクスチャ座標（胸の前面 UV の中心）。
   */
  logo: {
    material: 'Tops',
    text: 'ロロ',
    vertical: true,
    u: 0.5,
    v: 0.285,
    /** テクスチャ幅に対する1文字の大きさ */
    size: 0.25,
    /** 横方向の伸ばし（1 = そのまま） */
    stretchX: 1.3,
    lineGap: 1.08,
    color: '#ff2d8a',
    outline: '#7a1040',
    outlineWidth: 0.016,
    font: '900 {px}px "Rounded Mplus 1c", "M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Yu Gothic UI", "Noto Sans JP", sans-serif',
    /** 描画の上下反転（UV の向きがモデルによって違うため） */
    flipY: false,
  },
  /** 歩行速度（m/s）。1歩で車数台分。妹は自動で歩き続ける */
  walkSpeed: 5.5,
  /** W で加速、S で減速（倍率） */
  boostMul: 1.4,
  slowMul: 0.5,
  /** 1歩の周期（秒） */
  stepPeriod: 2.3,
  /** 旋回速度（rad/s） */
  turnSpeed: 0.55,
  /** 加減速のなめらかさ */
  accel: 1.4,
  /** 手続きアニメ（ズシーン歩き） */
  /** 子どもの横断歩道歩き：腕をピンと伸ばして大きく前後、大股 */
  walk: { legSwing: 0.42, kneeBend: 0.3, armSwing: 0.5, armDown: 1.35, bodyBob: 0.02, lean: 0.04, straightArms: true },
  /** 表情：口を大きく開けた笑顔（happy＋aa）。歩行中は少し強める */
  face: { happy: 0.4, mouthOpen: 0.35, mouthOpenWalk: 0.35, blinkPeriod: 3.5 },
  /** 肩の表面をレイキャストで探す（身長比）。肩関節から頭方向へ inward、真上 up の点から下向きに撃つ */
  shoulderProbe: { inward: 0.012, up: 0.08, far: 0.2, belowHead: 0.01, maxAbove: 0.05 },
  /** レイが当たらない時の高さ（肩関節から、身長比） */
  shoulderFallbackUp: 0.025,
  shoulderProbeInterval: 0.2,
  /** アンカーがレイ結果へ寄る速さ */
  shoulderFollowLerp: 6,
  /** 兄の立ち位置の微調整（m、妹の向き基準）：forward=前、outward=肩先側、up=上 */
  broSeat: { forward: 0.9, outward: 1.4, up: -1.1 },
  /** 着地の揺れの強さ */
  stepShake: 1.0,
  /** 髪（スプリングボーン）：スケール補正に掛ける倍率と抵抗。ロード時のウォームアップ歩数 */
  hairStiffnessScale: 1.0,
  hairGravityScale: 1.7,
  hairDrag: 0.7,
  hairWarmupSteps: 120,
  /** 兄の周りに髪を避けさせる球コライダー（m）。0 で無効 */
  broHairColliderRadius: 6,
  broHairColliderUp: 2.5,
}

export const LOCKON = {
  /** 同時ロック最大数 */
  maxLocks: 8,
  /** サイト中心からこの半径（画面高さ比）に入った敵をロック */
  reticleRadius: 0.12,
  /** ロック可能距離（m） */
  maxRange: 700,
  /** 投げの飛行速度（m/s） */
  flySpeed: 520,
  /** 光弾化：兄を包む光（芯・ハロの半径 m、色）と光の軌跡（幅 m・点数） */
  glow: { color: '#7fe9ff', coreColor: '#ffffff', coreRadius: 2.2, haloRadius: 6, trailWidth: 3.5, trailPoints: 70, trailOpacity: 0.9 },
  /** 妹が掴んで振りかぶる時間（秒） */
  windupSec: 0.35,
  /** 着弾ごとの停止（秒） */
  hitPauseSec: 0.08,
  /** 最後の敵から肩へ戻る秒数 */
  returnSec: 1.1,
  /** 帰還の弧の高さ（妹の身長比） */
  returnArc: 0.2,
  /** 爆発の大きさ（m）と時間 */
  explosionRadius: 16,
  explosionSec: 0.6,
  /** まとめ着弾のスコア倍率（n 体で n*multi） */
  comboMulti: 1.5,
  /** 地上からのロックオン攻撃：兄が自力で跳ぶ */
  ground: {
    /** 跳ぶ前のタメ（秒）と、その小ジャンプの高さ（m） */
    windupSec: 0.25,
    hopHeight: 2.5,
    /** 最後の敵から地面に降りる秒数 */
    landSec: 0.6,
    /** BRO.punchRange 以内・地表近く（この高さ以下）の敵はダッシュ打撃（飛ばずに殴る） */
    meleeMaxHeight: 30,
    /** ダッシュ打撃の速さ（m/s） */
    dashSpeed: 120,
  },
  /** 短く押して離した（この秒数未満）時は、ロック無しならジャンプ */
  tapSec: 0.25,
  /** サイト（パンツァードラグーン式）：溜め中はマウスでサイト自体が画面内を動く。画面端に寄るとカメラがその方向へ押されて回る */
  reticle: {
    /** マウス 1px でサイトが動く px */
    sensitivity: 1.0,
    /** 画面の中心からこの割合（画面の半分の大きさ比）を越えるとカメラを押し始める */
    edge: 0.62,
    /** 端まで押し込んだ時のカメラ回転速度（rad/s） */
    pushSpeed: 1.6,
    /** 溜めを離した後、サイトが中央に戻る速さ */
    recenterLerp: 10,
  },
  /** 1 体目への飛行ルート：ベジェ曲線（距離比）。side=横へ膨らむ、up=上へ膨らむ、End=着弾側の膨らみ */
  curve: { side: 0.45, up: 0.25, sideEnd: 0.15, upEnd: 0.1 },
}

/** テスト用の的（ステップ4で戦闘機に置き換え） */
export const DUMMY_ENEMIES = {
  count: 8,
  orbitRadius: 170,
  orbitSpeed: 0.25,
  heightMin: 35,
  heightMax: 95,
  size: 9,
  respawnSec: 4,
}

export const CAMERA = {
  near: 0.3,
  far: 1500,
  /** マウス感度（rad / px） */
  mouseSensitivity: 0.0025,
  touchSensitivity: 0.006,
  pitchMin: -0.9,
  pitchMax: 1.1,
  /** 地上：兄を中心にマウスで回すオービット。やや低めで妹が収まらない */
  ground: {
    /** 妹の方へカメラが戻る：入力が止まってからの秒数と速さ */
    pullDelaySec: 1.2,
    pullLerp: 0.9,
    fov: 78,
    distance: 4.5,
    /** 注視点の高さ（兄の腰〜胸） */
    targetHeight: 5,
    defaultPitch: 0.12,
  },
  /** タイトル画面：妹の正面から見上げ、下に兄・上にロロの顔 */
  title: { fov: 56, ahead: 69, side: 12, height: 1.5, lookAhead: 10, lookHeight: 26, broAhead: 57, broSide: 6 },
  /** 投擲中：兄と妹の両方を画面に。center は兄寄りの重み。enabled=false なら投擲中もカメラを変えない（今はこちら） */
  thrown: {
    enabled: false,
    fov: 70,
    broWeight: 0.6,
    /** 兄と妹の距離に応じた引き（最小・係数） */
    distanceMin: 22,
    distanceK: 0.75,
    /** 注視点からの高さ係数（距離比） */
    heightK: 0.14,
    followLerp: 7,
    /** 帰還後に肩カメラへなめらかに戻す秒数 */
    blendBackSec: 0.7,
  },
  /** 肩上：肩アンカーを中心にオービット。少し望遠 */
  shoulder: {
    fov: 55,
    distance: 33,
    /** 頭ボーンからの注視点オフセット（m） */
    targetHeight: -9,
    defaultPitch: 0.3,
  },
  /** 乗降中にカメラが体を突き抜けないよう外側に膨らませる距離(m) */
  transitionSideBulge: 30,
  /** 肩に乗った時のカメラの向き（妹の向きからの角度、rad）。-π/2 = 妹の左側から見る */
  mountViewYaw: -Math.PI / 2,
  /** 溜め中（左クリック）：兄の近くへ寄る照準カメラ。妹は半透明に */
  aim: {
    /** 肩上：兄からの距離（m）と注視の高さ（m） */
    distance: 7,
    height: 1.3,
    /** 地上：兄からの距離（m） */
    groundDistance: 2.6,
    fov: 50,
    /** 寄る／戻るのなめらかさ（秒） */
    blendSec: 0.25,
    /** 妹の不透明度（0..1） */
    imoutoOpacity: 0.45,
  },
  followLerp: 7,
  /** シェイク減衰 */
  shakeDecay: 9,
  shakeAmp: 0, // 一旦停止（後で調整）
}

export const STAGE = {
  /** 格子状の街。ブロック数（片側）。偶数にすると原点が交差点になる */
  blocks: 24,
  blockSize: 140,
  roadWidth: 34,
  /** 空（背景）と霞の色。最初は青空 */
  skyColor: '#7fc4ff',
  fogColor: '#bfe0ff',
  groundColor: '#8aa06a',
  roadColor: '#4a4a52',
  sidewalkColor: '#9c9a90',
  /** ビル高さ範囲 */
  buildingMin: 8,
  buildingMax: 38,
  towerChance: 0.05,
  towerMax: 95,
  /** 外部モデル（Kenney、CC0）で家とビルを描く。false なら箱と屋根のまま。読めなかった時も箱に戻る */
  kit: {
    enabled: true,
    houses: ['a', 'b', 'c', 'd', 'f', 'h', 'j', 'm', 'p', 's'].map((t) => `models/kit/houses/house-${t}.glb`),
    buildings: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((t) => `models/kit/buildings/building-${t}.glb`),
    skyscrapers: ['a', 'b', 'c', 'd', 'e'].map((t) => `models/kit/buildings/skyscraper-${t}.glb`),
    /** 家をマスに対してどのくらいの大きさにするか（1 = マスいっぱい） */
    houseFill: 0.95,
  },
}

/** ゲーム進行（区間・校門・制限時間） */
export const GAME = {
  /** 制限時間（秒） */
  timeLimitSec: 660,
  /** 残りこの秒数で妹が「こわがる」 */
  scaredSec: 60,
  /** 校門の z（妹は +Z へ進む）。スタートは IMOUTO.spawn */
  gateZ: 1400,
  gateHalfWidth: 45,
  /** 校舎・校庭の配置。パイロット版：遠くからでも分かる大きな校舎 */
  school: { z: 1600, width: 420, depth: 80, height: 48, yardDepth: 120, towerHeight: 40 },
  /** 区間（z の境界）：住宅街 → ビル街 → 航空公園 */
  sections: [
    { name: '住宅街', from: -9999, to: -500 },
    { name: 'ビル街', from: -500, to: 500 },
    { name: '航空公園', from: 500, to: 9999 },
  ],
  /** 建物破壊：妹の足元この半径（m）の建物が潰れる（妹の横幅 ≒ 12m より少し大きい程度）。1棟ごとのスコア減 */
  crushRadius: 8,
  crushPenalty: 30,
  crushSec: 0.35,
  /** 体に当たった建物：胴体の半径（m）と、この高さ以下の建物は踏み潰し、以上はブロックに砕ける */
  bodyRadius: 7,
  stompHeight: 26,
  debrisPerBuilding: 10,
  debrisSec: 3.5,
  /** 公園：この範囲は建物を置かない（|x| < halfWidth, z in [from, to]） */
  park: { halfWidth: 320, from: 560, to: 1250 },
  /** 行き先（▼ で示す）。今は校門。ロックオンすると妹がそこへ向かう。arriveDist 以内で到着扱い */
  dest: { label: '学校', x: 0, z: 1400, height: 60, arriveDist: 80 },
}

/** 兄のセリフ（吹き出し）。文言はここで変える */
export const SPEECH = {
  /** 表示秒数 */
  sec: 1.6,
  /** 旋回のセリフの連発を抑える秒数 */
  turnCooldownSec: 1.5,
  lines: {
    turnRight: '右へまわれ！',
    turnLeft: '左へ回れ！',
    skip: 'ロロップだ！',
    shoe: '蹴れ！',
    cry: '泣け！',
    throw: 'オレを投げろ！',
    goto: 'あそこへ行け！',
  },
}

/** 破壊表現：破片・部品・煙。物理エンジン無しの放物運動 */
export const DEBRIS = {
  /** 家が潰れた時：壁の破片数、屋根が飛び上がる速さ（m/s）、横に散る速さ */
  house: { wallPieces: 6, roofUp: 16, spread: 14 },
  /** 敵がやられた時：部品が飛び散る速さ（横・上、m/s） */
  burst: { spread: 22, up: 18 },
  /** 敵の種類ごとの部品（色・大きさ m・個数）。ここを変えれば見た目が変わる */
  parts: {
    police: [
      { color: '#f5f5f5', size: [2.4, 1.4, 2.8], n: 5 },
      { color: '#1a1a1a', size: [0.7, 1.8, 1.8], n: 4 },
      { color: '#ff2a2a', size: [1.8, 0.6, 0.9], n: 1 },
    ],
    tank: [
      { color: '#6b7a4a', size: [3.2, 2, 3.6], n: 6 },
      { color: '#3f4633', size: [1, 1.8, 1.8], n: 6 },
      { color: '#3f4633', size: [0.9, 0.9, 9], n: 1 },
    ],
    fighter: [
      { color: '#1f3fbf', size: [3, 1, 4], n: 5 },
      { color: '#f4f6ff', size: [2, 0.6, 3], n: 3 },
      { color: '#1f3fbf', size: [10, 0.4, 3.2], n: 2 },
      { color: '#e63946', size: [1.6, 0.6, 1.6], n: 1 },
    ],
    dummy: [{ color: '#ff8fa3', size: [2, 2, 2], n: 6 }],
    heli: [
      { color: '#3d6b3a', size: [3, 2, 4], n: 5 },
      { color: '#222222', size: [12, 0.3, 1], n: 2 },
      { color: '#9ad0ff', size: [1.6, 1.2, 1.6], n: 2 },
    ],
    /** エネミービル（1 発当たるごとに壁の破片） */
    boss: [
      { color: '#ffe066', size: [4, 3, 3], n: 4 },
      { color: '#e5322d', size: [2.5, 2.5, 2.5], n: 3 },
    ],
  } as Record<string, { color: string; size: [number, number, number]; n: number }[]>,
  /** 黒煙：個数、上昇速度、寿命秒、大きさ m */
  smoke: { n: 6, rise: 8, sec: 1.5, size: 6 },
  /** 砂煙リング（家・ビルが壊れた時）の大きさ m */
  dustSize: 30,
}

export const DEBUG = {
  showStats: false,
}
