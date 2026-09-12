import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm'

const gltfLoader = new GLTFLoader()
gltfLoader.register((parser) => new VRMLoaderPlugin(parser))

const cache = new Map<string, Promise<GLTF>>()
export function loadGLTF(url: string): Promise<GLTF> {
  let p = cache.get(url)
  if (!p) {
    p = gltfLoader.loadAsync(url)
    cache.set(url, p)
  }
  return p
}

/** VRM を読み込む。1体ごとに独立したインスタンスが必要なので毎回ロード（キャッシュはブラウザに任せる） */
export async function loadVRM(url: string): Promise<VRM> {
  const gltf = await gltfLoader.loadAsync(url)
  const vrm = gltf.userData.vrm as VRM
  VRMUtils.removeUnnecessaryVertices(gltf.scene)
  VRMUtils.combineSkeletons(gltf.scene)
  VRMUtils.rotateVRM0(vrm) // VRM0 は -Z 向きなので +Z に揃える
  vrm.scene.traverse((o) => {
    o.frustumCulled = false
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  return vrm
}

/** 候補のうち最初にファイルが存在するものを返す */
async function firstAvailable<T extends { url: string }>(items: readonly T[]): Promise<T> {
  for (const it of items) {
    try {
      const r = await fetch(it.url, { method: 'HEAD' })
      // SPA サーバーは無いパスにも index.html を 200 で返すので content-type で弾く
      if (r.ok && !(r.headers.get('content-type') ?? '').includes('text/html')) return it
    } catch {
      /* try next */
    }
  }
  return items[items.length - 1]
}

/** 候補（選択中→フォールバック順）から読み込む。返る choice は実際に使えたもの */
export function useVRM<T extends { url: string }>(items: readonly T[]): { vrm: VRM | null; choice: T | null } {
  const [state, setState] = useState<{ vrm: VRM | null; choice: T | null }>({ vrm: null, choice: null })
  const key = items.map((i) => i.url).join('|')
  useEffect(() => {
    let alive = true
    let loaded: VRM | null = null
    setState({ vrm: null, choice: null })
    firstAvailable(items).then(async (choice) => {
      const v = await loadVRM(choice.url)
      if (alive) {
        loaded = v
        setState({ vrm: v, choice })
      } else VRMUtils.deepDispose(v.scene)
    })
    return () => {
      alive = false
      if (loaded) VRMUtils.deepDispose(loaded.scene)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state
}
