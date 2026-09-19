import * as THREE from 'three'
import { useEffect, useState } from 'react'
import { STAGE } from '../config/game'
import { loadGLTF } from './loaders'
import { toonGradient } from './toon'

/** 街の建物用の外部モデル 1 種類（1 メッシュ 1 材質に焼いたもの）。InstancedMesh で大量配置する */
export interface KitType {
  kind: 'house' | 'building' | 'skyscraper'
  geometry: THREE.BufferGeometry
  material: THREE.Material
  /** モデル 1 単位の大きさ（幅・高さ・奥行）。原点は底面中央に揃えてある */
  size: THREE.Vector3
}

let promise: Promise<KitType[]> | null = null

async function loadOne(url: string, kind: KitType['kind']): Promise<KitType | null> {
  try {
    const g = await loadGLTF(url)
    let mesh: THREE.Mesh | null = null
    g.scene.updateMatrixWorld(true)
    g.scene.traverse((o) => {
      if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh
    })
    if (!mesh) return null
    const m = mesh as THREE.Mesh
    // ノードの変換を頂点に焼き込み、底面中央を原点にする
    const geometry = m.geometry.clone().applyMatrix4(m.matrixWorld)
    geometry.computeBoundingBox()
    const bb = geometry.boundingBox!
    const size = new THREE.Vector3().subVectors(bb.max, bb.min)
    geometry.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2)
    const src = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial
    // 見た目を街の他の部分（トゥーン）に合わせる。色はモデルのテクスチャのまま
    const material = new THREE.MeshToonMaterial({ map: src.map ?? null, color: src.map ? '#ffffff' : src.color, gradientMap: toonGradient() })
    return { kind, geometry, material, size }
  } catch {
    return null
  }
}

/** 全種類を 1 回だけ読む。1 つも読めなければ空（呼び出し側は箱に戻す） */
export function loadStageKit(): Promise<KitType[]> {
  if (!promise) {
    const k = STAGE.kit
    // ?lite で外部モデルを使わない（低スペック機・自動テスト用）
    const lite = typeof location !== 'undefined' && location.search.includes('lite')
    promise = k.enabled && !lite
      ? Promise.all([
          ...k.houses.map((u) => loadOne(u, 'house')),
          ...k.buildings.map((u) => loadOne(u, 'building')),
          ...k.skyscrapers.map((u) => loadOne(u, 'skyscraper')),
        ]).then((arr) => arr.filter((x): x is KitType => !!x))
      : Promise.resolve([])
  }
  return promise
}

/** null = 読み込み中。[] = 使わない（箱で描く） */
export function useStageKit(): KitType[] | null {
  const [kit, setKit] = useState<KitType[] | null>(null)
  useEffect(() => {
    let alive = true
    loadStageKit().then((k) => {
      if (alive) setKit(k)
    })
    return () => {
      alive = false
    }
  }, [])
  return kit
}
