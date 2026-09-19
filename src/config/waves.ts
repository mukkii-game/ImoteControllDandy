// 敵の構成。編隊パス・スモーク色・出現ルールはここだけ触る。

/** ブルーインパルス編隊 */
export const FIGHTERS = {
  /** 妹の z がこれ以上で出現（最初から） */
  fromZ: -99999,
  /** 編隊の機数 */
  count: 7,
  /**
   * 編隊の並び（機体ごと）：[横 m, 高さ m, 後ろへ m]。横に連なって少し斜め（画面上で線になる）。
   * まとめてサイトでなぞりやすいように、横の間隔は広め・前後はほぼ揃える
   */
  formation: [
    [-108, -20, 0],
    [-72, -13, -5],
    [-36, -6, -10],
    [0, 0, -14],
    [36, 6, -10],
    [72, 13, -5],
    [108, 20, 0],
  ] as [number, number, number][],
  /** 巡航速度 m/s */
  speed: 220,
  /** 同時に飛ぶ編隊の数（それぞれ別の方向のパスを回す） */
  squadrons: 2,
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
      name: '前から（近くで旋回）',
      loiter: 'near',
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
      name: '左から（遠くで旋回）',
      loiter: 'far',
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
      name: '上空に集合して爆撃',
      loiter: 'overhead',
      path: [
        [600, 200, 900],
        [300, 170, 500],
        [60, 150, 140],
        [-40, 140, 60],
        [-120, 130, -80],
        [-400, 150, -400],
        [-800, 180, -800],
      ],
    },
    {
      name: '右後ろから（近くで旋回）',
      loiter: 'near',
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
  ] as { name: string; loiter: 'near' | 'far' | 'overhead'; path: [number, number, number][] }[],
  /** 何秒に1発ミサイルを撃つか（編隊全体） */
  missileInterval: 3.2,
  missileSpeed: 30,
  /** 抜けた後（または全滅後）、次のセットが来るまで */
  respawnSec: 2.5,
  /**
   * 滞在：正面付近に着いたら、しばらく旋回してから抜ける。種類ごとに半径・高さ・秒数が違う。
   * near=近くで旋回、far=遠くで旋回、overhead=ロロの上空に集まって旋回（爆弾を落とす）
   */
  loiter: {
    blendSec: 1.2,
    turnSpeed: 0.55,
    heightWobble: 25,
    /**
     * 種類ごとの滞在。near/far は「ロロの前を斜めに大きく横切る」動き（リサージュ：center を中心に amp の振幅で往復）。
     * overhead はロロの上空を旋回（radius）。速さ speed（rad/s）
     */
    kinds: {
      near: { secMin: 8, secMax: 13, center: [0, 110, 260], amp: [260, 55, 60], speed: 1.2, radius: 0, height: 0 },
      far: { secMin: 7, secMax: 11, center: [0, 150, 460], amp: [420, 90, 80], speed: 0.9, radius: 0, height: 0 },
      overhead: { secMin: 12, secMax: 18, center: [0, 210, 20], amp: [0, 0, 0], speed: 1.1, radius: 135, height: 0 },
    },
    /** 上空集合の中心（妹ローカル：x=右, y=高さ, z=前） */
    overheadCenter: [0, 210, 20] as [number, number, number],
  },
  /**
   * 爆撃（上空集合中）：黒い爆弾が明るい光をまとって、ゆっくり妹へ向かって落ちてくる（見えやすく）。
   * interval=何秒に 1 発、speed=妹へ向かう速さ（m/s）、homing=妹の方へ曲がる強さ、gravity=落下の加速度、
   * hitRadius=命中とみなす半径（妹の胴体中心から）。size=爆弾の半径、haloSize=光の半径。妹にダメージは無い（減速と被弾エフェクトだけ）
   */
  bomb: { interval: 0.9, speed: 14, homing: 1.5, gravity: 2, hitRadius: 30, size: 2, haloSize: 5, color: '#111318', haloColor: '#fff0a0', haloOpacity: 0.55, pulse: 6 },
  /** パラシュートで降りるパイロット */
  pilotFallSpeed: 6,
  pilotSec: 8,
}

/** ヘリ：開始直後から来て、妹から一定の距離を取りながら周りを回って待機し、時々撃つ。編隊（groups × perGroup 機）でまとまって動く */
export const HELIS = {
  /** 編隊の数と、1 編隊の機数（最低 4 機） */
  groups: 2,
  perGroup: 4,
  /** 編隊内の並び（機体ごと）：[横 m, 高さ m, 前後 m]。横一列（ロロから見て横）に少し上下差 */
  formation: [
    [-54, 6, 0],
    [-18, 0, 8],
    [18, 0, 8],
    [54, 6, 0],
    [-90, 12, -8],
    [90, 12, -8],
  ] as [number, number, number][],
  /** 妹からの距離（m）と高さ（m）。高さは編隊ごとに少しずらす */
  keepDist: 260,
  height: 70,
  heightSpread: 24,
  /** 妹の周りを回る角速度（rad/s）と機体の移動速度（m/s） */
  orbitSpeed: 0.22,
  speed: 45,
  /** 機体の大きさ（m、全長） */
  size: 16,
  rotorSpeed: 28,
  shotInterval: 2.8,
  shotSpeed: 28,
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
  shotSpeed: 30,
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
  /** 体を左右に揺らしながら近づく：根元の傾き（rad）、揺れの速さ（rad/s）、上半分の追加のしなり（根元の傾きに対する倍率） */
  sway: { amp: 0.07, speed: 1.6, bend: 0.8 },
}
/** エネミービルの配置：スタート（z=-1000）の先、ビル街（z=-500）の手前。進行方向（+z）を向いて右にぎょうざの満洲、左に山田うどん（この世界は +z を向くと -x が画面右） */
export const BOSSES = [
  { name: 'ぎょうざの満洲', image: 'textures/boss_manshu.png', imageAspect: 350 / 381, x: -70, z: -720, w: 46, h: 62, d: 46, color: '#ffe873', signBg: '#e5322d', signColor: '#ffffff' },
  { name: '山田うどん', image: 'textures/boss_yamada.png', imageAspect: 248 / 449, x: 70, z: -660, w: 48, h: 58, d: 48, color: '#fff4dc', signBg: '#d0301f', signColor: '#ffffff' },
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
  shellSpeed: 28,
  size: { w: 12, h: 7, d: 20 },
}

/**
 * 敵の弾（ミサイル・砲弾）の見た目：本体の半径（m）と、周りの明るい光（半径・色・脈動）。爆弾は FIGHTERS.bomb。
 * 光は登録簿（systems/projectiles）にある弾すべてに entities/ProjectileGlow が付ける
 */
export const PROJECTILE = {
  /** ミサイル：胴体の半径（m）と長さ（半径比）、色（胴体は金属っぽい灰色、先端は赤） */
  bodyRadius: 0.9,
  bodyLength: 5,
  color: '#8a8f99',
  noseColor: '#e63946',
  /** バルカンの当たり判定・自動照準に使う半径（m。見た目より大きめ） */
  hitRadius: 4,
  haloRadius: 2.5,
  haloColor: '#ffe9a0',
  haloOpacity: 0.5,
  pulse: 7,
}

/** 被弾時の妹の反応（ダメージ無し）：驚き顔＋短い減速（SPEC：0.5 秒減速）。slowFactor は減速中の速度倍率 */
export const HIT = {
  slowSec: 0.5,
  slowFactor: 0.35,
  /** 着弾の爆発の大きさ（m、兄と同じくらい）と、飛び散る火の玉→黒煙の粒の数・大きさ（m） */
  explosionRadius: 5,
  puffs: 7,
  puffSize: 2.2,
  /** 驚き顔の秒数 */
  faceSec: 0.4,
  /** 命中判定の半径（m、妹の胴体中心から） */
  radius: 30,
}
