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
    duration: 1.4,
    cooldown: 12,
    /** モーション：脚を後ろへ振る秒数（windBackSec）→ 前へ蹴り出す秒数（kickSec）。蹴り出し切った瞬間に靴が飛ぶ */
    windBackSec: 0.35,
    kickSec: 0.2,
    /** 靴の速度（m/s）・飛距離（m）・当たり幅（m） */
    speed: 220,
    range: 700,
    width: 40,
    /** 靴の大きさ（m） */
    size: 14,
    /** 靴が通った道の建物を砕く半径（m）と、当たった敵・建物の吹っ飛ぶ高さの倍率（通常の何倍か） */
    breakRadius: 30,
    power: 2,
    /** 靴の後ろに続く火柱：何 m ごとに 1 本、高さ・半径（m）、消えるまでの秒数、色 */
    pillar: { every: 22, height: 85, radius: 9, lifeSec: 0.9, color: '#ff7a1a', coreColor: '#fff0a0' },
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
