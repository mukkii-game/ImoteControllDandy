import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PROJECTILE } from '../config/waves'
import { projectiles } from '../systems/projectiles'

const MAX = 128
const m4 = new THREE.Matrix4()

/** 登録簿にある敵の弾すべてに、明るい光（脈動する加算合成の球）を付けて見えやすくする */
export function ProjectileGlow() {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  useFrame(() => {
    const m = mesh.current
    const pulse = 1 + 0.18 * Math.sin((performance.now() / 1000) * PROJECTILE.pulse)
    let n = 0
    for (const p of projectiles) {
      if (p.dead || n >= MAX) continue
      const r = Math.max(PROJECTILE.haloRadius, p.radius * 1.2) * pulse
      m4.makeScale(r, r, r)
      m4.setPosition(p.pos)
      m.setMatrixAt(n++, m4)
    }
    m.count = n
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX]} frustumCulled={false} userData={{ noXray: true }}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshBasicMaterial color={PROJECTILE.haloColor} transparent opacity={PROJECTILE.haloOpacity} blending={THREE.AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  )
}
