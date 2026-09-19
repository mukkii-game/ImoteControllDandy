import { useEffect, useRef } from 'react'
import { useGame } from '../systems/store'
import { refs } from '../systems/refs'
import { SPEECH } from '../config/game'

/** 兄の吹き出し。兄の頭の上（画面座標は lockon が毎フレーム更新）に一定秒数出す */
export function Speech() {
  const speech = useGame((s) => s.speech)
  const el = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const e = el.current
      if (!e) return
      const s = useGame.getState().speech
      const alive = s && performance.now() - s.at < SPEECH.sec * 1000
      const [x, y, inFront] = refs.broScreen
      if (!alive || !inFront) {
        e.style.display = 'none'
        return
      }
      e.style.display = 'block'
      // 画面から出ないように寄せる
      const cx = Math.min(window.innerWidth - 120, Math.max(120, x))
      const cy = Math.min(window.innerHeight - 40, Math.max(70, y))
      e.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -100%)`
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div ref={el} className="speech" key={speech?.at ?? 0}>
      {speech?.text}
    </div>
  )
}
