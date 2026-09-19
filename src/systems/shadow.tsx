import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { refs } from './refs'

/** 妹を中心に追従する影用ライト。シャドウカメラは妹全体が入るサイズ */
export function ShadowFollower({ size }: { size: number }) {
  const light = useRef<THREE.DirectionalLight>(null!)
  const target = useRef<THREE.Object3D>(null!)
  useFrame(() => {
    const im = refs.imouto
    if (!im) return
    target.current.position.copy(im.position)
    light.current.position.set(im.position.x + 120, 180, im.position.z - 90)
    light.current.target = target.current
  })
  return (
    <>
      <object3D ref={target} />
      <directionalLight
        ref={light}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-size}
        shadow-camera-right={size}
        shadow-camera-top={size}
        shadow-camera-bottom={-size}
        shadow-camera-near={1}
        shadow-camera-far={420}
        shadow-normalBias={0.4}
      />
    </>
  )
}
