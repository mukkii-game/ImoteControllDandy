import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Suspense, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { loadGLTF, useVRM } from '../systems/loaders'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

function VRMView({ url, x }: { url: string; x: number }) {
  const vrm = useVRM(url)
  useFrame((_, dt) => vrm?.update(dt))
  if (!vrm) return null
  return <primitive object={vrm.scene} position={[x, 0, 0]} />
}

function GLBView({ url, x, clip }: { url: string; x: number; clip?: string }) {
  const [scene, setScene] = useState<THREE.Object3D | null>(null)
  const mixer = useRef<THREE.AnimationMixer | null>(null)
  useEffect(() => {
    loadGLTF(url).then((g) => {
      const s = SkeletonUtils.clone(g.scene) as THREE.Object3D
      s.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = true
      })
      console.log(url, 'clips:', g.animations.map((a) => a.name).join(', '))
      mixer.current = new THREE.AnimationMixer(s)
      const c = g.animations.find((a) => a.name === clip) ?? g.animations[0]
      if (c) mixer.current.clipAction(c).play()
      setScene(s)
    })
  }, [url, clip])
  useFrame((_, dt) => mixer.current?.update(dt))
  if (!scene) return null
  return <primitive object={scene} position={[x, 0, 0]} />
}

/** 開発用：?viewer でモデルを並べて確認 */
export function ModelViewer() {
  return (
    <Canvas shadows camera={{ position: [0, 1.4, 5.5], fov: 45 }}>
      <color attach="background" args={['#e8e8e8']} />
      <ambientLight intensity={1} />
      <directionalLight position={[3, 5, 4]} intensity={2} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#ccc" />
      </mesh>
      <Suspense fallback={null}>
        <VRMView url="models/Seed-san.vrm" x={-2.4} />
        <VRMView url="models/VRM1_Twist_Sample.vrm" x={-0.8} />
        <GLBView url="models/Xbot.glb" x={0.8} clip="run" />
        <GLBView url="models/Soldier.glb" x={2.4} clip="Run" />
      </Suspense>
      <OrbitControls target={[0, 1, 0]} />
    </Canvas>
  )
}
