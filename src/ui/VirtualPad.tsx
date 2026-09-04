import { useRef } from 'react'
import { useInput } from '../systems/input'

const R = 50

/** スマホ用：左に仮想スティック、右に A/B。ステップ8で仕上げる。今は動作確認用の最小版 */
export function VirtualPad() {
  const base = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLDivElement>(null)
  const activeId = useRef<number | null>(null)

  const move = (e: React.PointerEvent) => {
    if (activeId.current !== e.pointerId || !base.current || !knob.current) return
    const r = base.current.getBoundingClientRect()
    let dx = e.clientX - (r.left + r.width / 2)
    let dy = e.clientY - (r.top + r.height / 2)
    const len = Math.hypot(dx, dy)
    if (len > R) {
      dx = (dx / len) * R
      dy = (dy / len) * R
    }
    knob.current.style.transform = `translate(${dx}px, ${dy}px)`
    useInput.getState().setStick(dx / R, -dy / R)
  }
  const end = (e: React.PointerEvent) => {
    if (activeId.current !== e.pointerId) return
    activeId.current = null
    if (knob.current) knob.current.style.transform = ''
    useInput.getState().setStick(0, 0)
  }

  const set = useInput((s) => s.set)
  return (
    <>
      <div
        ref={base}
        className="stick"
        onPointerDown={(e) => {
          activeId.current = e.pointerId
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          move(e)
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div ref={knob} className="knob" />
      </div>
      <div className="buttons">
        <button
          className="btn btn-b"
          onPointerDown={(e) => {
            e.preventDefault()
            set('b', true)
          }}
          onPointerUp={() => set('b', false)}
          onPointerCancel={() => set('b', false)}
        >
          B
        </button>
        <button
          className="btn btn-a"
          onPointerDown={(e) => {
            e.preventDefault()
            set('a', true)
          }}
          onPointerUp={() => set('a', false)}
          onPointerCancel={() => set('a', false)}
        >
          A
        </button>
      </div>
    </>
  )
}
