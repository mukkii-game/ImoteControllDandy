import { SKILLS, type SkillId } from '../config/skills'
import { useGame } from '../systems/store'
import { useInput } from '../systems/input'

/** 妹の技ボタン（肩上のみ）。クリック／タップでも発動。クールダウンを円で表示 */
export function SkillBar() {
  const mode = useGame((s) => s.mode)
  const cds = useGame((s) => s.cooldowns)
  const active = useGame((s) => s.activeSkill)
  const phase = useGame((s) => s.phase)
  if (phase !== 'play' || (mode !== 'shoulder' && mode !== 'thrown')) return null
  const ids = Object.keys(SKILLS) as SkillId[]
  return (
    <div className="skillbar">
      {ids.map((id) => {
        const cfg = SKILLS[id]
        const cd = cds[id] ?? 0
        const ratio = cd / cfg.cooldown
        return (
          <button
            key={id}
            className={`skill ${cd > 0 ? 'cd' : ''} ${active === id ? 'active' : ''}`}
            onPointerDown={(e) => {
              e.preventDefault()
              useInput.getState().press(`skill${cfg.key}` as 'skill1')
            }}
            style={{ ['--cd' as string]: `${ratio * 100}%` }}
          >
            <span className="key">{cfg.key}</span>
            <span className="label">{cfg.label}</span>
            {cd > 0 && <span className="time">{cd.toFixed(0)}</span>}
          </button>
        )
      })}
    </div>
  )
}
