// 敵の構成。編隊パス・スモーク色・出現ルールはここだけ触る。

/** ブルーインパルス編隊 */
export const FIGHTERS = {
  /** 妹の z がこれ以上で出現（区間2から） */
  fromZ: -500,
  /** 編隊の機数と V 字の間隔（m） */
  count: 5,
  spacing: 18,
  /** 巡航速度 m/s */
  speed: 95,
  /** 機体の大きさ（m、全長） */
  size: 24,
  /** スモーク色（機体順） */
  smokeColors: ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#f72585', '#ffffff'],
  /** スモークの長さ（点数）と幅（m） */
  smokePoints: 70,
  smokeWidth: 5,
  /** 妹を基準にしたパス（ローカル：x=右, y=高さ, z=前）。前を横切って後ろへ抜けてまた前へ */
  path: [
    [-420, 90, 260],
    [-120, 70, 140],
    [120, 60, 60],
    [380, 90, -80],
    [380, 130, -320],
    [80, 120, -420],
    [-260, 100, -300],
    [-420, 80, -60],
    [-360, 70, 200],
    [-120, 60, 320],
    [200, 80, 340],
    [420, 110, 200],
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

/** 被弾時の妹の反応 */
export const HIT = {
  slowSec: 0.5,
  slowFactor: 0.25,
  /** 命中判定の半径（m、妹の胴体中心から） */
  radius: 30,
}
