import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { loadGLTF } from '../systems/loaders'
import { TOKOROS } from '../config/game'
import { TokorosRig } from '../systems/tokorosRig'

/** 開発用：?tokoros でトコロスの平泳ぎを近くで確認。window.__tk.phase に 0..1 を入れると止めて見られる */
function Model() {
  const [scene, setScene] = useState<THREE.Object3D | null>(null)
  const rig = useRef<TokorosRig | null>(null)
  const group = useRef<THREE.Group>(null!)
  const t = useRef(0)
  useEffect(() => {
    loadGLTF(TOKOROS.url).then((g) => {
      const s = g.scene
      const box = new THREE.Box3().setFromObject(s)
      const k = 2 / (box.max.y - box.min.y)
      s.scale.setScalar(k)
      s.position.set(-(box.min.x + box.max.x) * 0.5 * k, -(box.min.y + box.max.y) * 0.5 * k, -(box.min.z + box.max.z) * 0.5 * k)
      rig.current = new TokorosRig(s)
      ;(window as unknown as { __tk: { phase: number | null; ok: boolean; cam: number[] | null } }).__tk = { phase: null, ok: rig.current.ok, cam: null }
      setScene(s)
    })
  }, [])
  useFrame((state, dt) => {
    t.current += dt
    const tk = (window as unknown as { __tk?: { phase: number | null; cam: number[] | null } }).__tk
    if (tk?.cam) {
      state.camera.position.set(tk.cam[0], tk.cam[1], tk.cam[2])
      state.camera.lookAt(0, 0, 0)
    }
    const ph = tk?.phase ?? (t.current / TOKOROS.stroke.period) % 1
    group.current.updateWorldMatrix(true, false)
    rig.current?.pose(ph)
  })
  return (
    <group ref={group} rotation={[TOKOROS.prone, 0, 0]}>
      {scene && <primitive object={scene} />}
    </group>
  )
}

export function TokorosViewer() {
  return (
    <Canvas camera={{ position: [3.5, 2.5, 3.5], fov: 40 }}>
      <color attach="background" args={['#e8e8e8']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 6, 4]} intensity={1.2} />
      <gridHelper args={[6, 12]} position={[0, -1.2, 0]} />
      <axesHelper args={[2]} />
      <Model />
    </Canvas>
  )
}
