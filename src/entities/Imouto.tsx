import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { IMOUTO, SCALE } from '../config/game'
import { refs } from '../systems/refs'

/**
 * 妹（ステップ1：箱）。身長1のプリミティブ人型を組み、group の scale で 60m にする。
 * 座標を巨大にしない（SPEC 8）。
 */
export function Imouto() {
  const group = useRef<THREE.Group>(null!)
  const shoulder = useRef<THREE.Object3D>(null!)

  useEffect(() => {
    refs.imouto = group.current
    refs.shoulder = shoulder.current
    return () => {
      refs.imouto = null
      refs.shoulder = null
    }
  }, [])

  const h = SCALE.imoutoHeight
  const s = IMOUTO.shoulderLocal

  return (
    <group ref={group} position={[IMOUTO.spawn.x, IMOUTO.spawn.y, IMOUTO.spawn.z]} scale={h}>
      {/* 以下はすべて身長1の比率 */}
      {/* 脚 */}
      <mesh position={[-0.09, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 0.44, 0.14]} />
        <meshStandardMaterial color="#f7d9c4" />
      </mesh>
      <mesh position={[0.09, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 0.44, 0.14]} />
        <meshStandardMaterial color="#f7d9c4" />
      </mesh>
      {/* 靴 */}
      <mesh position={[-0.09, 0.02, 0.02]} castShadow>
        <boxGeometry args={[0.13, 0.05, 0.2]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0.09, 0.02, 0.02]} castShadow>
        <boxGeometry args={[0.13, 0.05, 0.2]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* スカート */}
      <mesh position={[0, 0.47, 0]} castShadow>
        <boxGeometry args={[0.34, 0.12, 0.22]} />
        <meshStandardMaterial color={IMOUTO.skirtColor} />
      </mesh>
      {/* 胴（セーラー服） */}
      <mesh position={[0, 0.66, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 0.28, 0.18]} />
        <meshStandardMaterial color="#f4f4f8" />
      </mesh>
      {/* 襟 */}
      <mesh position={[0, 0.77, 0.03]} castShadow>
        <boxGeometry args={[0.3, 0.06, 0.16]} />
        <meshStandardMaterial color={IMOUTO.skirtColor} />
      </mesh>
      {/* 腕 */}
      <mesh position={[-0.2, 0.64, 0]} castShadow>
        <boxGeometry args={[0.08, 0.3, 0.08]} />
        <meshStandardMaterial color="#f4f4f8" />
      </mesh>
      <mesh position={[0.2, 0.64, 0]} castShadow>
        <boxGeometry args={[0.08, 0.3, 0.08]} />
        <meshStandardMaterial color="#f4f4f8" />
      </mesh>
      {/* 頭 */}
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshStandardMaterial color={IMOUTO.color} />
      </mesh>
      {/* 髪 */}
      <mesh position={[0, 0.97, -0.02]} castShadow>
        <boxGeometry args={[0.24, 0.1, 0.24]} />
        <meshStandardMaterial color={IMOUTO.hairColor} />
      </mesh>
      {/* 目（前が +Z） */}
      <mesh position={[-0.05, 0.9, 0.101]}>
        <boxGeometry args={[0.03, 0.04, 0.01]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0.05, 0.9, 0.101]}>
        <boxGeometry args={[0.03, 0.04, 0.01]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* 肩アンカー（兄が座る位置） */}
      <object3D ref={shoulder} position={[s.x, s.y, s.z]} />
    </group>
  )
}
