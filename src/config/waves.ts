// 敵の構成。編隊パス・スモーク色・出現ルールはここだけ触る。

/** ブルーインパルス編隊 */
export const FIGHTERS = {
  /** 妹の z がこれ以上で出現（区間2から） */
  fromZ: -500,
  /** 編隊の機数と V 字の間隔（m） */
  count: 5,
  spacing: 22,
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
  /** スモークの長さ（点数）と幅（m） */
  smokePoints: 70,
  smokeWidth: 5,
  /** 妹を基準にしたパス（ローカル：x=右, y=高さ, z=前）。前を横切って後ろへ抜けてまた前へ */
  path: [
    [-180, 78, 110],
    [-80, 72, 135],
    [0, 68, 140],
    [80, 72, 135],
    [180, 78, 110],
    [240, 100, -30],
    [170, 120, -170],
    [0, 130, -230],
    [-170, 120, -170],
    [-240, 100, -30],
  ] as [number, number, number][],
  /** 何秒に1発ミサイルを撃つか（編隊全体） */
  missileInterval: 3.2,
  missileSpeed: 140,
  /** 全滅後、次の編隊が来るまで */
  respawnSec: 6,
  /** パラシュートで降りるパイロット */
  pilotFallSpeed: 6,
  pilotSec: 8,
}

export const POLICE = {
  /** 妹の前方 この距離ごとに道路上へ配置 */
  spacing: 110,
  aheadMin: 120,
  aheadMax: 520,
  /** 同時に存在する最大数 */
  max: 8,
  /** 踏み潰し判定：妹の足元からの半径（m） */
  stompRadius: 26,
  size: { w: 7, h: 4, d: 14 },
}

export const TANKS = {
  fromZ: -500,
  spacing: 260,
  aheadMin: 200,
  aheadMax: 600,
  max: 3,
  /** 側方へのオフセット（道路脇） */
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
