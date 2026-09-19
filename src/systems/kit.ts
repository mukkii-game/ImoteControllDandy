import * as THREE from 'three'
import { useEffect, useState } from 'react'
import { loadGLTF } from './loaders'

export interface KitEntry {
  url: string
  scale?: number
  yaw?: number
  /** 上下の補正（m）。タイヤが地面に埋まる時などに */
  y?: number
}
export type KitManifest = Partial<Record<'police' | 'tank' | 'jet', KitEntry>>

let manifestPromise: Promise<KitManifest> | null = null

/** public/models/kit/manifest.json を1回だけ読む。無ければ空 */
export function loadManifest(): Promise<KitManifest> {
  if (!manifestPromise) {
    manifestPromise = fetch('models/kit/manifest.json')
      .then((r) => (r.ok && !(r.headers.get('content-type') ?? '').includes('text/html') ? r.json() : {}))
      .catch(() => ({}))
  }
  return manifestPromise
}

/** manifest に書かれたモデルを読み、無ければ null（プリミティブのまま） */
export function useKitModel(key: keyof KitManifest): { scene: THREE.Object3D; entry: KitEntry } | null {
  const [res, setRes] = useState<{ scene: THREE.Object3D; entry: KitEntry } | null>(null)
  useEffect(() => {
    let alive = true
    loadManifest().then(async (m) => {
      const entry = m[key]
      if (!entry) return
      try {
        const g = await loadGLTF(entry.url)
        const scene = g.scene
        const s = entry.scale ?? 1
        scene.scale.setScalar(s)
        scene.rotation.y = entry.yaw ?? 0
        scene.position.y = entry.y ?? 0
        scene.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) o.castShadow = true
        })
        if (alive) setRes({ scene, entry })
      } catch {
        /* keep primitive */
      }
    })
    return () => {
      alive = false
    }
  }, [key])
  return res
}
