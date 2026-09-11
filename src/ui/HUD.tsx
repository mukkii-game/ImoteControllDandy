import { useGame } from '../systems/store'
import { VirtualPad } from './VirtualPad'

export function HUD() {
  const mode = useGame((s) => s.mode)
  const loaded = useGame((s) => s.loaded)
  const ready = loaded.imouto && loaded.bro

  let hint = ''
  if (mode === 'ground') hint = 'WASD 走る / Space ジャンプ / Shift 妹の肩へ飛び乗る'
  if (mode === 'shoulder') hint = 'W 前進 / A D 旋回 / Shift 飛び降りる'

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="title">いもーとコントロールダンディ <span className="step">prototype</span></div>
        <div className="mode">{mode === 'shoulder' ? '肩上' : mode === 'ground' ? '地上' : '…'}</div>
      </div>
      {!ready && <div className="loading">モデル読み込み中…</div>}
      {hint && ready && <div className="hint">{hint}</div>}
      <VirtualPad />
    </div>
  )
}
