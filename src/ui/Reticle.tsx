import { useEffect, useRef } from 'react'
import { useGame } from '../systems/store'
import { lock } from '../systems/enemies'
import { LOCKON, GAME } from '../config/game'
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
  const dest = useRef<HTMLDivElement>(null)

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
      // 行き先マーカー（▼ 学校）。画面外なら端に寄せる
      const dm = dest.current
      if (dm) {
        const [dx, dy, inFront] = lock.destScreen
        const W = window.innerWidth
        const H = window.innerHeight
        let x = dx
        let y = dy
        if (!inFront) {
          x = W - dx
          y = 80
        }
        const off = !inFront || x < 30 || x > W - 30 || y < 60 || y > H - 40
        x = Math.min(W - 40, Math.max(40, x))
        y = Math.min(H - 60, Math.max(70, y))
        dm.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`
        dm.classList.toggle('locked', lock.dest)
        dm.classList.toggle('offscreen', off)
      }
      if (ring.current) ring.current.style.height = ring.current.style.width = `${LOCKON.reticleRadius * 2 * window.innerHeight}px`
      // 地上：倒せる敵にサイトが重なっていると赤く太く光る
      el.classList.toggle('target', refs.rideTarget >= 0 || refs.aimTarget >= 0 || refs.aimProjectile >= 0)
      // 建物に重なっている（A で屋上へ跳ぶ）と黄色
      el.classList.toggle('roof', refs.roofTarget >= 0)
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
      <div ref={dest} className="dest-marker">
        <div className="tri">▼</div>
        <div className="name">{GAME.dest.label}</div>
      </div>
    </div>
  )
}
