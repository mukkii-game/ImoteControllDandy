import * as THREE from 'three'
import { SKILLS, type SkillId } from '../config/skills'
import { enemies, killEnemy, stunAll } from './enemies'
import { emit } from './events'
import { useGame } from './store'

/** 妹の技の状態。Imouto が毎フレーム tick する */
export class SkillRunner {
  active: SkillId | null = null
  t = 0
  cooldown: Record<SkillId, number> = { skip: 0, shoe: 0, cry: 0 }
  private hitClock = 0
  private hudClock = 0

  canUse(id: SkillId) {
    return this.active === null && this.cooldown[id] <= 0
  }

  private shoeLaunched = false

  start(id: SkillId, pos: THREE.Vector3, yaw: number) {
    if (!this.canUse(id)) return false
    this.active = id
    this.t = 0
    this.hitClock = 0
    this.shoeLaunched = false
    this.cooldown[id] = SKILLS[id].cooldown
    useGame.getState().setActiveSkill(id)
    emit('imouto.skill', { id })
    if (id === 'cry') stunAll(SKILLS.cry.stunSec)
    void pos
    void yaw
    return true
  }

  tick(dt: number, pos: THREE.Vector3, yaw = 0) {
    for (const k of Object.keys(this.cooldown) as SkillId[]) this.cooldown[k] = Math.max(0, this.cooldown[k] - dt)
    if (this.active) {
      this.t += dt
      // 靴飛ばし：脚を後ろへ振って前へ蹴り出し切った瞬間に靴が飛ぶ
      if (this.active === 'shoe' && !this.shoeLaunched && this.t >= SKILLS.shoe.windBackSec + SKILLS.shoe.kickSec) {
        this.shoeLaunched = true
        emit('shoe.launch', { x: pos.x + Math.sin(yaw) * 6, y: pos.y + 8, z: pos.z + Math.cos(yaw) * 6, yaw })
      }
      if (this.active === 'skip') {
        this.hitClock += dt
        if (this.hitClock >= SKILLS.skip.hitEvery) {
          this.hitClock = 0
          sweep(pos, SKILLS.skip.radius)
        }
      }
      if (this.t >= SKILLS[this.active].duration) {
        this.active = null
        useGame.getState().setActiveSkill(null)
      }
    }
    this.hudClock += dt
    if (this.hudClock > 0.2) {
      this.hudClock = 0
      useGame.getState().setCooldowns({ ...this.cooldown })
    }
  }
}

/** 周囲の敵を薙ぐ */
function sweep(center: THREE.Vector3, radius: number) {
  let n = 0
  for (const e of enemies) {
    if (!e.alive) continue
    const dx = e.pos.x - center.x
    const dz = e.pos.z - center.z
    const dy = e.pos.y - center.y
    if (Math.hypot(dx, dz) < radius && dy < 90) {
      killEnemy(e.id)
      emit('enemy.hit', { id: e.id, x: e.pos.x, y: e.pos.y, z: e.pos.z })
      n++
    }
  }
  if (n > 0) {
    const st = useGame.getState()
    st.addScore(80 * n * (n > 1 ? n : 1))
    if (n > 1) st.setCombo(n)
  }
}
