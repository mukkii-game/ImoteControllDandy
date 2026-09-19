// 敵の構成。編隊パス・スモーク色・出現ルールはここだけ触る。

/** ブルーインパルス編隊 */
export const FIGHTERS = {
  /** 妹の z がこれ以上で出現（最初から） */
  fromZ: -99999,
  /** 編隊の機数 */
  count: 5,
  /** 編隊の並び（機体ごと）：[横 m, 高さ m, 後ろへ m]。前後・上下にばらして、プレイヤーから見て重ならないように（多重ロックしやすく） */
  formation: [
    [0, 0, 0],
    [-40, 16, -30],
    [44, -14, -28],
    [-84, 34, -62],
    [88, -26, -58],
  ] as [number, number, number][],
  /** 巡航速度 m/s */
  speed: 70,
  /** 妹の正面（この距離・角度内）では減速してホバリング気味に留まる */
  hoverDist: 200,
  hoverAngleDeg: 70,
  hoverSpeedMul: 0.3,
  /** 機体の大きさ（m、全長） */
  size: 36,
  /** スモーク色（機体順） */
  smokeColors: ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#f72585', '#ffffff'],
  /** スモークの長さ（点数）、幅（m）、濃さ（0..1） */
  smokePoints: 70,
  smokeWidth: 3.5,
  smokeOpacity: 0.28,
  /**
   * エネセット（仮）：出現方向ごとのパス（妹ローカル：x=右, y=高さ, z=前）。
   * 一方向からまとまって入ってきて、正面で減速し、次のセットが来る方向へ抜けていく（視線の誘導）。
   * 順番に回す。ちゃんとしたエネセットは別途計画してここを書き換える。
   */
  passes: [
    {
      name: '前から',
      path: [
        [0, 130, 1100],
        [0, 100, 700],
        [-30, 82, 360],
        [-110, 74, 180],
        [-230, 86, 130],
        [-460, 110, 220],
        [-800, 140, 420],
      ],
    },
    {
      name: '左から',
      path: [
        [-900, 130, 320],
        [-560, 100, 230],
        [-260, 80, 165],
        [-70, 72, 150],
        [130, 76, 150],
        [330, 92, 40],
        [580, 116, -200],
        [860, 140, -480],
      ],
    },
    {
      name: '右後ろから',
      path: [
        [800, 150, -700],
        [460, 116, -400],
        [220, 96, -150],
        [140, 84, 70],
        [50, 76, 150],
        [-60, 74, 165],
        [-30, 95, 450],
        [0, 130, 1000],
      ],
    },
  ] as { name: string; path: [number, number, number][] }[],
  /** 何秒に1発ミサイルを撃つか（編隊全体） */
  missileInterval: 3.2,
  missileSpeed: 140,
  /** 抜けた後（または全滅後）、次のセットが来るまで */
  respawnSec: 2.5,
  /** 滞在：正面付近に着いたら、しばらくプレイヤーの近くを旋回してから抜ける。秒数は範囲からランダム */
  loiter: { secMin: 6, secMax: 12, radius: 110, turnSpeed: 0.55, heightWobble: 25, blendSec: 1.2 },
  /** パラシュートで降りるパイロット */
  pilotFallSpeed: 6,
  pilotSec: 8,
}

/** ヘリ：開始直後から来て、妹から一定の距離を取りながら周りを回って待機し、時々撃つ */
export const HELIS = {
  count: 3,
  /** 妹からの距離（m）と高さ（m）。高さは機体ごとに少しずらす */
  keepDist: 210,
  height: 55,
  heightSpread: 18,
  /** 妹の周りを回る角速度（rad/s）と機体の移動速度（m/s） */
  orbitSpeed: 0.22,
  speed: 45,
  /** 機体の大きさ（m、全長） */
  size: 16,
  rotorSpeed: 28,
  shotInterval: 2.8,
  shotSpeed: 120,
  /** やられてから戻ってくるまで（秒）。遠くから飛んでくる */
  respawnSec: 6,
  spawnDist: 700,
}

export const POLICE = {
  /** 妹の前方 この距離ごとに道路上へ配置 */
  spacing: 110,
  aheadMin: 120,
  aheadMax: 520,
  /** 同時に存在する最大数 */
  max: 8,
  /** 踏み潰し判定：妹の足元からの半径（m）。妹の横幅より少し大きい程度 */
  stompRadius: 9,
  size: { w: 7, h: 4, d: 14 },
  /** 動き：妹にこの距離まで近づいて撃つ。妹が fleeDist より近づいたら離れる */
  speed: 34,
  keepDist: 230,
  fleeDist: 130,
  /** 何秒に 1 発撃つか（パトカー全体）と弾速 */
  shotInterval: 2.2,
  shotSpeed: 130,
}

/** エネミービル（ビルの形をした敵）。妹と同じくらい大きく、近づくとにじり寄ってくる。通り抜けられない */
export const BOSS = {
  /** 倒すのに必要なロックオン命中数（＝ロック点の数） */
  hits: 4,
  /** この距離まで妹が来たら寄ってくる（m）／これ以上は近づかない */
  aggroDist: 450,
  stopDist: 40,
  creepSpeed: 4,
  /** ロック点をビルの中に散らばらせる範囲（0..1、内側に寄せる） */
  pointInset: 0.3,
  score: 500,
}
export const BOSSES = [
  { name: 'ぎょうざの満洲', image: 'textures/boss_manshu.png', imageAspect: 350 / 381, x: -22, z: -1260, w: 46, h: 62, d: 46, color: '#ffe873', signBg: '#e5322d', signColor: '#ffffff' },
  { name: '山田うどん', image: 'textures/boss_yamada.png', imageAspect: 248 / 449, x: 26, z: -1040, w: 48, h: 58, d: 48, color: '#fff4dc', signBg: '#d0301f', signColor: '#ffffff' },
]

export const TANKS = {
  fromZ: -500,
  spacing: 260,
  aheadMin: 200,
  aheadMax: 600,
  max: 3,
  /** 側方へのオフセット（道路脇）。1 グループは同じ側から、次のグループは反対側から */
  side: 40,
  shellInterval: 4,
  shellSpeed: 110,
  size: { w: 12, h: 7, d: 20 },
}

/** 被弾時の妹の反応（ダメージ無し。驚くだけ） */
export const HIT = {
  slowSec: 0,
  slowFactor: 1,
  /** 驚き顔の秒数 */
  faceSec: 0.4,
  /** 命中判定の半径（m、妹の胴体中心から） */
  radius: 30,
}
