import { FIRE_SCHEDULE, type FireSource } from '../config/waves'
import { enemies } from './enemies'

/**
 * 敵の弾の時間帯（config/waves の FIRE_SCHEDULE）。
 * 「今どの種類の敵が撃ってよいか」を時間で回す。各エンティティは撃つ前に canFire() を見て、間隔には fireRateMul() を掛ける。
 * 毎フレーム fireScheduleTick() で進める（LockonSystem から呼ぶ）
 */
export const fireSchedule = {
  /** 今の時間帯の番号（phases の添字） */
  index: 0,
  /** 今の時間帯に入ってからの秒数 */
  t: 0,
  /** 時間帯が切り替わった回数（ヘリの「どの編隊が撃つか」などの選び分けに使う） */
  phaseNo: 0,
}

/** その種類の敵が今 1 体でも生きているか */
function anyAlive(sources: FireSource[]): boolean {
  return enemies.some((e) => e.alive && (sources as string[]).includes(e.kind))
}

function enterPhase(index: number) {
  fireSchedule.index = index
  fireSchedule.t = 0
  fireSchedule.phaseNo++
}

/** 次の時間帯へ。撃てる敵がいない時間帯は飛ばす（一周しても見つからなければそのまま進む） */
function advance() {
  const ph = FIRE_SCHEDULE.phases
  let next = (fireSchedule.index + 1) % ph.length
  if (FIRE_SCHEDULE.skipEmpty) {
    for (let n = 0; n < ph.length; n++) {
      const p = ph[next]
      if (p.sources.length === 0 || anyAlive(p.sources)) break
      next = (next + 1) % ph.length
    }
  }
  enterPhase(next)
}

export function fireScheduleTick(dt: number) {
  const ph = FIRE_SCHEDULE.phases
  if (!FIRE_SCHEDULE.enabled || ph.length === 0) return
  if (fireSchedule.index >= ph.length) fireSchedule.index = 0
  fireSchedule.t += dt
  if (fireSchedule.t >= ph[fireSchedule.index].sec) advance()
}

/** その種類の敵が今撃ってよいか */
export function canFire(source: FireSource): boolean {
  const ph = FIRE_SCHEDULE.phases
  if (!FIRE_SCHEDULE.enabled || ph.length === 0) return true
  return ph[fireSchedule.index]?.sources.includes(source) ?? true
}

/** 今の時間帯の発射間隔の倍率（撃てない時間帯では 1） */
export function fireRateMul(source: FireSource): number {
  const ph = FIRE_SCHEDULE.phases
  if (!FIRE_SCHEDULE.enabled || ph.length === 0) return 1
  const p = ph[fireSchedule.index]
  return p && p.sources.includes(source) ? p.rateMul : 1
}

/** 時間帯ごとに 1 つだけ選ぶ（例：ヘリのどの編隊が撃つか）。撃てる時間帯の中で順繰り */
export function firePick(count: number): number {
  return count <= 0 ? 0 : fireSchedule.phaseNo % count
}
