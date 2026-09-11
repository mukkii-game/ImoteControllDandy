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

export function useVRM(url: string): VRM | null {
  const [vrm, setVrm] = useState<VRM | null>(null)
  useEffect(() => {
    let alive = true
    loadVRM(url).then((v) => {
      if (alive) setVrm(v)
      else VRMUtils.deepDispose(v.scene)
    })
    return () => {
      alive = false
    }
  }, [url])
  return vrm
}
