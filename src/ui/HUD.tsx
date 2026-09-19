import { useGame } from '../systems/store'
import { VirtualPad } from './VirtualPad'
import { TunePanel } from './TunePanel'
import { useModels } from '../systems/models'
import { Reticle } from './Reticle'
import { Speech } from './Speech'
import { Radar } from './Radar'
import { SkillBar } from './SkillBar'
import { Overlays } from './Overlays'
import { useEffect, useState } from 'react'

export function HUD() {
  const mode = useGame((s) => s.mode)
  const phase = useGame((s) => s.phase)
  const loaded = useGame((s) => s.loaded)
  const ready = loaded.imouto && loaded.bro
  const resolved = useModels((s) => s.resolved)
  const credits = [resolved.imouto?.credit, resolved.bro?.credit].filter(Boolean).join(' / ')
  const score = useGame((s) => s.score)
  const combo = useGame((s) => s.combo)
  const [comboVisible, setComboVisible] = useState(false)
  useEffect(() => {
    if (!combo) return
    setComboVisible(true)
    const t = setTimeout(() => setComboVisible(false), 1400)
    return () => clearTimeout(t)
  }, [combo])

  return (
    <div className="hud">
      <div className={`hud-top ${phase === 'title' ? 'hidden' : ''}`}>
        <div className="title">いもーとコントロールダンディ <span className="step">prototype</span></div>
        <div className="mode">{mode === 'shoulder' ? '肩上' : mode === 'ground' ? '地上' : mode === 'thrown' ? '攻撃中' : '…'}</div>
      </div>
      <div className="score">SCORE {score}</div>
      {combo && comboVisible && <div className="combo">{combo.n}機まとめ！</div>}
      <Reticle />
      <Speech />
      <Radar />
      <SkillBar />
      <Overlays />
      {!ready && <div className="loading">モデル読み込み中…</div>}
      {credits && <div className="credits">モデル: {credits}</div>}
      <VirtualPad />
      <TunePanel />
    </div>
  )
}
