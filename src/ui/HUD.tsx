import { useGame } from '../systems/store'
import { VirtualPad } from './VirtualPad'

export function HUD() {
  const mode = useGame((s) => s.mode)
  const canMount = useGame((s) => s.canMount)

  let hint = ''
  if (mode === 'ground') hint = canMount ? 'B（Shift）で妹に乗る' : 'WASD で移動。妹の足元へ行こう'
  if (mode === 'shoulder') hint = 'B（Shift）で降りる'

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="title">いもーとコントロールダンディ <span className="step">step1: スケール検証</span></div>
        <div className="mode">{mode === 'shoulder' ? '肩上' : mode === 'ground' ? '地上' : '…'}</div>
      </div>
      {hint && <div className={`hint ${canMount ? 'hint-ready' : ''}`}>{hint}</div>}
      <VirtualPad />
    </div>
  )
}
