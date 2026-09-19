import { useGame } from '../systems/store'
import { GAME, IMOUTO } from '../config/game'
import { refs } from '../systems/refs'
import { useEffect, useState } from 'react'

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** タイトル・タイマー・クリア・遅刻 */
export function Overlays() {
  const phase = useGame((s) => s.phase)
  const setPhase = useGame((s) => s.setPhase)
  const timeLeft = useGame((s) => s.timeLeft)
  const score = useGame((s) => s.score)
  const clearTime = useGame((s) => s.clearTime)
  const loaded = useGame((s) => s.loaded)
  const paused = useGame((s) => s.tuneOpen)
  const ready = loaded.imouto && loaded.bro
  const [dist, setDist] = useState(0)
  const [section, setSection] = useState('')

  useEffect(() => {
    const id = setInterval(() => {
      const im = refs.imouto
      if (!im) return
      setDist(Math.max(0, Math.round(GAME.gateZ - im.position.z)))
      const sec = GAME.sections.find((s) => im.position.z >= s.from && im.position.z < s.to)
      setSection(sec?.name ?? '')
    }, 250)
    return () => clearInterval(id)
  }, [])

  const urgent = phase === 'play' && timeLeft < GAME.scaredSec

  return (
    <>
      {phase === 'play' && (
        <div className={`timer ${urgent ? 'urgent' : ''}`}>
          <div className="t">{fmt(timeLeft)}</div>
          <div className="d">
            {section} ・ 学校まで {dist}m
          </div>
        </div>
      )}
      {phase === 'play' && paused && <div className="pause-badge">PAUSE</div>}
      {phase === 'title' && (
        <div className="overlay title-screen">
          <div className="logo">
            <span>いもーと</span>
            <span>コントロールダンディ</span>
          </div>
          <div className="sub story">
            巨大妹「{IMOUTO.name}」を学校に送り届けるんだ
            <br />
            なぜならオレはお兄ちゃんだからな
          </div>
          <div className="howto">
            <div>WASD：兄の移動 / 肩の上では妹の方向指示（A D 旋回・W 加速・S 減速）</div>
            <div>マウス：カメラ　　右クリック / Shift：肩に飛び乗る・飛び降りる</div>
            <div>左クリック長押し：サイトを動かして敵をロック → 離すと攻撃（肩上は妹が投げる・地上は自分で跳ぶ。近い敵はパンチ）</div>
            <div>1 / 2 / 3（テンキー可）：スキップ・靴飛ばし・泣く　ホイールで選択・ホイールクリックで発動</div>
            <div>制限時間 {fmt(GAME.timeLimitSec)}。校門をまたげばクリア</div>
          </div>
          <button className="start" disabled={!ready} onClick={() => setPhase('play')}>
            {ready ? 'いってきまーす' : 'モデル読み込み中…'}
          </button>
        </div>
      )}
      {phase === 'clear' && (
        <div className="overlay result">
          <div className="big">とうこう かんりょう！</div>
          <div className="sub">キーンコーンカーンコーン</div>
          <div className="stats">
            タイム {fmt(clearTime)} ／ SCORE {score}
          </div>
          <button className="start" onClick={() => location.reload()}>
            もういちど
          </button>
        </div>
      )}
      {phase === 'late' && (
        <div className="overlay result late">
          <div className="big">ちこく…</div>
          <div className="sub">先生に叱られた（巨大なのに縮こまる）</div>
          <div className="stats">SCORE {score}</div>
          <button className="start" onClick={() => location.reload()}>
            リトライ
          </button>
        </div>
      )}
    </>
  )
}
