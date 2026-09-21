import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TOKOROS, SCALE } from '../config/game'
import { loadGLTF } from '../systems/loaders'
import { refs } from '../systems/refs'
import { useGame } from '../systems/store'
import { TokorosRig } from '../systems/tokorosRig'

const center = new THREE.Vector3()
const look = new THREE.Vector3()

/**
 * 怪鳥トコロス（TOKOROS）：ロロの頭の高さでロロの周りを回る。うつぶせで平泳ぎのリズムで飛ぶ。
 * モデルは骨無しなので、体全体の上下・うなずき・ロール・速さの揺れで「かいて伸びる」を表す
 */
export function Tokoros() {
  const group = useRef<THREE.Group>(null!)
  const inner = useRef<THREE.Group>(null!)
  const [scene, setScene] = useState<THREE.Object3D | null>(null)
  const angle = useRef(Math.random() * Math.PI * 2)
  const t = useRef(0)
  const rig = useRef<TokorosRig | null>(null)

  useEffect(() => {
    if (!TOKOROS.enabled) return
    let alive = true
    loadGLTF(TOKOROS.url)
      .then((g) => {
        const s = g.scene
        const box = new THREE.Box3().setFromObject(s)
        const h = Math.max(1e-3, box.max.y - box.min.y)
        const k = TOKOROS.height / h
        s.scale.setScalar(k)
        // 体の中心を原点に（うつぶせに回した時に中心で回るように）
        s.position.set(-(box.min.x + box.max.x) * 0.5 * k, -(box.min.y + box.max.y) * 0.5 * k, -(box.min.z + box.max.z) * 0.5 * k)
        s.traverse((o) => {
          const m = o as THREE.Mesh
          if (m.isMesh) {
            m.castShadow = true
            m.frustumCulled = false
          }
        })
        rig.current = new TokorosRig(s)
        if (alive) setScene(s)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  useFrame((_, dt) => {
    const g = group.current
    const im = refs.imouto
    if (!g || !im || !scene) return
    const c = TOKOROS
    const st = useGame.getState()
    if (st.phase === 'clear' || st.phase === 'late') return
    t.current += dt
    const ph = (t.current / c.stroke.period) * Math.PI * 2
    // 平泳ぎ：蹴った直後（位相 0.8 前後）は速く、伸びている間はゆっくり
    const surge = 1 + c.stroke.surge * Math.sin(ph - Math.PI * 0.6)
    angle.current += c.orbitSpeed * dt * surge
    // 回る中心：ロロの頭
    if (refs.head) refs.head.getWorldPosition(center)
    else center.set(im.position.x, im.position.y + SCALE.imoutoHeight, im.position.z)
    center.y += c.above
    const a = angle.current
    const r = c.orbitRadius
    g.position.set(center.x + Math.cos(a) * r, center.y + Math.sin(ph) * c.stroke.bob, center.z + Math.sin(a) * r)
    // 進行方向（円の接線）を向く。+z が前
    look.set(g.position.x - Math.sin(a) * Math.sign(c.orbitSpeed), g.position.y, g.position.z + Math.cos(a) * Math.sign(c.orbitSpeed))
    g.lookAt(look)
    // うつぶせ＋うなずき＋ロール
    const inn = inner.current
    inn.rotation.set(c.prone - c.noseUp - c.stroke.pitch * Math.sin(ph + Math.PI / 2), 0, c.stroke.roll * Math.sin(ph * 0.5))
    // 骨の平泳ぎ（位相 0..1）
    if (rig.current?.ok) {
      g.updateWorldMatrix(true, false)
      rig.current.pose(t.current / c.stroke.period)
    }
  })

  if (!TOKOROS.enabled) return null
  return (
    <group ref={group}>
      <group ref={inner}>{scene && <primitive object={scene} />}</group>
    </group>
  )
}
