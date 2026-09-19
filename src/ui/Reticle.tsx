import { useEffect, useRef } from 'react'
import { useGame } from '../systems/store'
import { lock } from '../systems/enemies'
import { LOCKON } from '../config/game'
import { refs } from '../systems/refs'

/**
 * サイト（画面中央）とロックマーカー。毎フレーム DOM を直接更新（React 再描画なし）。
 */
export function Reticle() {
  const charging = useGame((s) => s.charging)
  const mode = useGame((s) => s.mode)
  const phase = useGame((s) => s.phase)
  const layer = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const count = useRef<HTMLDivElement>(null)
  const sight = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    const markers: HTMLDivElement[] = []
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = layer.current
      if (!el) return
      // マーカーの数を合わせる
      while (markers.length < LOCKON.maxLocks) {
        const m = document.createElement('div')
        m.className = 'lock-marker'
        el.appendChild(m)
        markers.push(m)
      }
      markers.forEach((m, i) => {
        const id = lock.ids[i]
        const sc = id !== undefined ? lock.screen.get(id) : undefined
        if (!sc || !sc[2]) {
          m.style.display = 'none'
          return
        }
        m.style.display = 'block'
        m.style.transform = `translate(${sc[0]}px, ${sc[1]}px) translate(-50%, -50%)`
        m.textContent = String(i + 1)
      })
      if (count.current) count.current.textContent = lock.ids.length ? `LOCK ${lock.ids.length}` : ''
      if (ring.current) ring.current.style.height = ring.current.style.width = `${LOCKON.reticleRadius * 2 * window.innerHeight}px`
      // サイトの位置（溜め中はマウスで動く）
      if (sight.current) sight.current.style.transform = `translate(${refs.reticleX}px, ${refs.reticleY}px)`
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      markers.forEach((m) => m.remove())
    }
  }, [])

  const show = (mode === 'shoulder' || mode === 'ground') && phase === 'play'
  return (
    <div ref={layer} className={`reticle-layer ${show ? '' : 'hidden'} ${charging ? 'charging' : ''}`}>
      <div ref={sight} className="reticle-sight">
        <div ref={ring} className="reticle-ring" />
        <div className="reticle-dot" />
        <div ref={count} className="lock-count" />
      </div>
    </div>
  )
}
