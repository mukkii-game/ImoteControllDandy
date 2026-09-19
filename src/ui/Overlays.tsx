import { useGame } from '../systems/store'
import { GAME, IMOUTO, QUALITY } from '../config/game'
import { useQuality } from '../systems/quality'
import { refs } from '../systems/refs'
import { useEffect, useRef, useState } from 'react'

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
  const quality = useQuality()
  const ready = loaded.imouto && loaded.bro
  const [dist, setDist] = useState(0)
  const [section, setSection] = useState('')
  /** エリアに入った時の巨大な地名（areaTitleSec 秒で消える） */
  const [areaTitle, setAreaTitle] = useState<string | null>(null)
  const lastArea = useRef<string | null>(null)

  useEffect(() => {
    let hide = 0
    const id = setInterval(() => {
      const im = refs.imouto
      if (!im) return
      setDist(Math.max(0, Math.round(GAME.gateZ - im.position.z)))
      const area = GAME.areas.find((s) => im.position.z >= s.from && im.position.z < s.to)?.name ?? ''
      setSection(area)
      // プレイ中にエリアが変わったら（最初のエリアも）巨大表示
      if (useGame.getState().phase === 'play' && area && area !== lastArea.current) {
        lastArea.current = area
        setAreaTitle(area)
        clearTimeout(hide)
        hide = window.setTimeout(() => setAreaTitle(null), GAME.areaTitleSec * 1000)
      }
    }, 250)
    return () => {
      clearInterval(id)
      clearTimeout(hide)
    }
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
      {phase === 'play' && areaTitle && !paused && (
        <div key={areaTitle} className="area-title">
          {areaTitle}
        </div>
      )}
      {phase === 'title' && (
        <div className="overlay title-screen">
          <div className="logo">
            <span>いもーと</span>
            <span>コントロールダンディ</span>
            <span className="subtitle">進め！ジャイアントロロ</span>
          </div>
          <div className="sub story">
            巨大妹「{IMOUTO.name}」を学校に送り届けるんだ
            <br />
            なぜならオレはお兄ちゃんだからな
          </div>
          <div className="howto">
            <div>WASD：兄の移動 / 肩の上では妹の方向指示（A D 旋回・W 加速・S 減速）</div>
            <div>マウス：カメラ　　右クリック / Shift：肩に飛び乗る・飛び降りる</div>
            <div>肩上：左クリック長押しでサイトを動かして敵をロック → 離すと妹が投げる　　地上：左クリックでサイトの向きへ高速タックル</div>
            <div>1 / 2 / 3（テンキー可）：スキップ・靴飛ばし・泣く　ホイールで選択・ホイールクリックで発動</div>
            <div>制限時間 {fmt(GAME.timeLimitSec)}。校門をまたげばクリア</div>
          </div>
          <div className="howto-touch">左スティックで移動　乗降ボタンで妹の肩へ　投げボタン長押しで敵をロック→離すと投擲　技ボタンは右下</div>
          {/* 重さ（品質）の切り替え：スマホは Esc が無いのでここで選ぶ */}
          <div className="quality-pick">
            <span>重さ：</span>
            {(['auto', 'low', 'mid', 'high'] as const).map((c) => (
              <button key={c} className={quality.choice === c ? 'on' : ''} onClick={() => quality.setChoice(c)}>
                {c === 'auto' ? '自動' : QUALITY.presets[c].label}
              </button>
            ))}
            <span className="q-note">{quality.choice === 'auto' ? `（今：${QUALITY.presets[quality.level].label}。開始後に自動判定）` : '重いときは「低」'}</span>
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
