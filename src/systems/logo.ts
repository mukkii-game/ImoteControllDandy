import * as THREE from 'three'
import type { VRM } from '@pixiv/three-vrm'
import { IMOUTO } from '../config/game'

/**
 * 服のテクスチャを Canvas に複製して、胸にロゴ文字を描いて差し替える。
 * 対象マテリアルは名前の部分一致（config IMOUTO.logo.material）。
 */
export function applyLogo(vrm: VRM) {
  const cfg = IMOUTO.logo
  if (!cfg.text) return
  const mats = new Set<THREE.Material & { map?: THREE.Texture | null }>()
  vrm.scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const arr = Array.isArray(m.material) ? m.material : [m.material]
    for (const mat of arr) if ((mat.name ?? '').includes(cfg.material)) mats.add(mat as THREE.Material & { map?: THREE.Texture | null })
  })
  for (const mat of mats) {
    const src = mat.map
    if (!src || !src.image) continue
    const img = src.image as HTMLImageElement | ImageBitmap | HTMLCanvasElement
    const w = (img as { width: number }).width
    const h = (img as { height: number }).height
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    // three は flipY で上下を扱うので、ここでは画像のピクセル座標で描く。v は glTF 座標（0 が上）
    ctx.drawImage(img as CanvasImageSource, 0, 0)
    if (location.search.includes('uvgrid')) {
      // デバッグ：UV 位置を目視で特定するための番号グリッド
      const cols = 8
      const rowsN = 16
      ctx.font = `bold ${Math.round(w / cols / 3)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (let r = 0; r < rowsN; r++)
        for (let c = 0; c < cols; c++) {
          const x0 = (c * w) / cols
          const y0 = (r * h) / rowsN
          ctx.fillStyle = (r + c) % 2 ? 'rgba(80,160,255,0.35)' : 'rgba(255,120,80,0.35)'
          ctx.fillRect(x0, y0, w / cols, h / rowsN)
          ctx.fillStyle = '#000'
          ctx.fillText(`${r}-${c}`, x0 + w / cols / 2, y0 + h / rowsN / 2)
        }
    }
    const px = cfg.size * w
    const cx = cfg.u * w
    const cy = cfg.v * h
    ctx.save()
    if (cfg.flipY) {
      ctx.translate(cx, cy)
      ctx.scale(1, -1)
      ctx.translate(-cx, -cy)
    }
    ctx.font = cfg.font.replace('{px}', String(Math.round(px)))
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    const chars = cfg.vertical ? Array.from(cfg.text) : [cfg.text]
    const step = px * cfg.lineGap
    const total = step * (chars.length - 1)
    chars.forEach((ch, i) => {
      const y = cy - total / 2 + i * step
      ctx.lineWidth = cfg.outlineWidth * w
      ctx.strokeStyle = cfg.outline
      ctx.strokeText(ch, cx, y)
      ctx.fillStyle = cfg.color
      ctx.fillText(ch, cx, y)
    })
    ctx.restore()
    const tex = new THREE.CanvasTexture(canvas)
    tex.flipY = src.flipY
    tex.colorSpace = src.colorSpace
    tex.wrapS = src.wrapS
    tex.wrapT = src.wrapT
    tex.minFilter = src.minFilter
    tex.magFilter = src.magFilter
    tex.generateMipmaps = src.generateMipmaps
    tex.anisotropy = src.anisotropy
    tex.needsUpdate = true
    mat.map = tex
    mat.needsUpdate = true
  }
}
