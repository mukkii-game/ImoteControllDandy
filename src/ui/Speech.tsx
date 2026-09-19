import { useEffect, useRef } from 'react'
import { useGame } from '../systems/store'
import { refs } from '../systems/refs'
import { SPEECH } from '../config/game'

/** 吹き出し 1 つ分。who の頭の上（画面座標は lockon が毎フレーム更新）に一定秒数出す */
function Bubble({ who }: { who: 'bro' | 'imouto' }) {
  const speech = useGame((s) => (who === 'bro' ? s.speech : s.imoutoSpeech))
  const el = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const e = el.current
      if (!e) return
      const st = useGame.getState()
      const s = who === 'bro' ? st.speech : st.imoutoSpeech
      const alive = s && performance.now() - s.at < SPEECH.sec * 1000
      const [x, y, inFront] = who === 'bro' ? refs.broScreen : refs.imoutoScreen
      if (!alive || !inFront) {
        e.style.display = 'none'
        return
      }
      e.style.display = 'block'
      // 画面から出ないように寄せる
      const cx = Math.min(window.innerWidth - 220, Math.max(220, x))
      const cy = Math.min(window.innerHeight - 40, Math.max(110, y))
      e.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -100%)`
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [who])

  return (
    <div ref={el} className={`speech speech-${who}`} key={speech?.at ?? 0} style={{ fontSize: who === 'bro' ? SPEECH.fontPx : SPEECH.imoutoFontPx }}>
      {speech?.text}
    </div>
  )
}

/** 兄と妹の吹き出し */
export function Speech() {
  return (
    <>
      <Bubble who="bro" />
      <Bubble who="imouto" />
    </>
  )
}
