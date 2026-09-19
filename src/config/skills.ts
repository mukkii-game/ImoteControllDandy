// 妹の技。範囲・時間・クールダウンはここだけ触る。

export const SKILLS = {
  skip: {
    key: '1',
    label: 'スキップ',
    /** 技の実行時間（秒） */
    duration: 2.2,
    cooldown: 8,
    /** 周囲この半径の敵を薙ぐ（m） */
    radius: 90,
    /** 薙ぎ判定が出る周期（秒）：跳ねるたびに当たる */
    hitEvery: 0.55,
    /** スキップ中の前進速度倍率 */
    speedMul: 1.3,
  },
  shoe: {
    key: '2',
    label: '靴飛ばし',
    duration: 1.0,
    cooldown: 12,
    /** 靴の速度（m/s）・飛距離（m）・当たり幅（m） */
    speed: 220,
    range: 700,
    width: 40,
    /** 靴の大きさ（m） */
    size: 14,
  },
  cry: {
    key: '3',
    label: '泣く',
    duration: 2.5,
    cooldown: 30,
    /** 敵をスタンさせる秒数 */
    stunSec: 5,
  },
} as const

export type SkillId = keyof typeof SKILLS
