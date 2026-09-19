import { useEffect, useRef } from 'react'
import { RADAR } from '../config/game'
import { refs } from '../systems/refs'
import { enemies } from '../systems/enemies'
import { useGame } from '../systems/store'

/**
 * レーダーマップ（右上、半透明）。中心はロロ、ロロの向きが上。一定範囲だけ表示。
 * 兄＝水色、雑魚＝小さい点（空中は少し明るい）、ボス（エネミービル）＝大きい点。
 */
export function Radar() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const phase = useGame((s) => s.phase)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const c = canvas.current
      const im = refs.imouto
      if (!c || !im) return
      const ctx = c.getContext('2d')
      if (!ctx) return
      const S = RADAR.size
      const R = S / 2
      const k = R / RADAR.range
      ctx.clearRect(0, 0, S, S)
      // 背景の円
      ctx.save()
      ctx.beginPath()
      ctx.arc(R, R, R - 1, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(10, 16, 28, ${RADAR.opacity})`
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.clip()
      // 距離の目安の輪
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      for (const f of [0.5]) {
        ctx.beginPath()
        ctx.arc(R, R, R * f, 0, Math.PI * 2)
        ctx.stroke()
      }
      // ワールド → レーダー座標（ロロの向きが上）
      const yaw = im.rotation.y
      const cy = Math.cos(yaw)
      const sy = Math.sin(yaw)
      const toMap = (x: number, z: number): [number, number] => {
        const dx = x - im.position.x
        const dz = z - im.position.z
        // ロロの前方（sin yaw, cos yaw）を上に
        const fwd = dx * sy + dz * cy
        const right = dx * cy - dz * sy
        return [R + right * k, R - fwd * k]
      }
      // 敵
      for (const e of enemies) {
        if (!e.alive) continue
        const [x, y] = toMap(e.pos.x, e.pos.z)
        if (Math.hypot(x - R, y - R) > R) continue
        const boss = e.kind === 'boss'
        const air = e.kind === 'fighter' || e.kind === 'heli'
        ctx.beginPath()
        ctx.arc(x, y, boss ? RADAR.bossDot : RADAR.dot, 0, Math.PI * 2)
        ctx.fillStyle = boss ? RADAR.bossColor : air ? RADAR.airColor : RADAR.enemyColor
        ctx.fill()
      }
      // 兄
      if (refs.bro) {
        const [x, y] = toMap(refs.bro.position.x, refs.bro.position.z)
        ctx.beginPath()
        ctx.arc(Math.max(3, Math.min(S - 3, x)), Math.max(3, Math.min(S - 3, y)), RADAR.broDot, 0, Math.PI * 2)
        ctx.fillStyle = RADAR.broColor
        ctx.fill()
      }
      // ロロ（中心の三角、上向き）
      ctx.beginPath()
      ctx.moveTo(R, R - 7)
      ctx.lineTo(R + 5, R + 5)
      ctx.lineTo(R - 5, R + 5)
      ctx.closePath()
      ctx.fillStyle = RADAR.imoutoColor
      ctx.fill()
      ctx.restore()
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  if (phase !== 'play') return null
  return <canvas ref={canvas} className="radar" width={RADAR.size} height={RADAR.size} />
}
