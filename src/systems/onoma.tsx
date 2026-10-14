import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { ONOMA } from '../config/game'
import { on } from './events'

/**
 * 描き文字（ズシーン・ドカーン等）。3D の位置を画面へ投影して、キャンバスの上に DOM の文字を出す（.onoma、index.css）。
 * 数値・言葉は config の ONOMA
 */
export function Onomatopoeia() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    if (!ONOMA.enabled) return
    const parent = gl.domElement.parentElement
    if (!parent) return
    const layer = document.createElement('div')
    layer.className = 'onoma-layer'
    parent.appendChild(layer)
    const last: Record<string, number> = {}
    const idx: Record<string, number> = {}
    const v = new THREE.Vector3()

    const show = (kind: string, x: number, y: number, z: number, strength = 1) => {
      const k = ONOMA.kinds[kind]
      if (!k || strength < k.minStrength) return
      const now = performance.now() / 1000
      if (now - (last[kind] ?? -99) < k.cooldownSec) return
      v.set(x, y, z).project(camera)
      if (v.z > 1 || v.z < -1) return
      last[kind] = now
      const w = layer.clientWidth
      const h = layer.clientHeight
      // 画面の外なら端に寄せる（文字が半分切れても出す）
      const sx = THREE.MathUtils.clamp((v.x * 0.5 + 0.5) * w, w * 0.08, w * 0.92)
      const sy = THREE.MathUtils.clamp((-v.y * 0.5 + 0.5) * h, h * 0.12, h * 0.88)
      const i = (idx[kind] = ((idx[kind] ?? -1) + 1) % k.words.length)
      const el = document.createElement('div')
      el.className = 'onoma'
      el.textContent = k.words[i]
      el.style.left = `${sx}px`
      el.style.top = `${sy}px`
      el.style.fontSize = `${Math.round(h * k.size)}px`
      el.style.color = k.color
      el.style.fontFamily = ONOMA.font
      el.style.setProperty('--rot', `${(Math.random() - 0.5) * 24}deg`)
      el.style.animationDuration = `${ONOMA.lifeSec}s`
      layer.appendChild(el)
      window.setTimeout(() => el.remove(), ONOMA.lifeSec * 1000 + 50)
    }

    const offs = [
      on('imouto.step', ({ x, z, strength }) => show('step', x, 2, z, strength)),
      on('enemy.hit', ({ x, y, z }) => show('hit', x, y, z)),
      on('bomb.burst', ({ x, y, z }) => show('bomb', x, y, z)),
      on('bro.land', ({ x, y, z }) => show('land', x, y, z)),
      on('projectile.shot', ({ x, y, z }) => show('shot', x, y, z)),
      on('building.crush', ({ x, z, h }) => show('crush', x, h, z)),
    ]
    return () => {
      offs.forEach((f) => f())
      layer.remove()
    }
  }, [camera, gl])
  return null
}
