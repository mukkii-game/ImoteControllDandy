import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LOCKON } from '../config/game'
import { refs } from '../systems/refs'
import { useGame } from '../systems/store'
import { SmokeRibbon } from '../systems/smoke'

/**
 * 光弾化した兄。攻撃中（thrown）は光の球に包まれ、光るレーザーのような軌跡を引く（パンツァードラグーン／レイフォース風）。
 */
export function BroGlow() {
  const group = useRef<THREE.Group>(null!)
  const core = useRef<THREE.Mesh>(null!)
  const halo = useRef<THREE.Mesh>(null!)
  const [bro, setBro] = useState<THREE.Object3D | null>(null)
  const t = useRef(0)
  const k = useRef(0)

  // refs.bro は Bro のマウント後に入るので、揃ってから軌跡を出す
  useEffect(() => {
    const id = setInterval(() => {
      if (refs.bro) {
        setBro(refs.bro)
        clearInterval(id)
      }
    }, 100)
    return () => clearInterval(id)
  }, [])

  useFrame((_, dt) => {
    const st = useGame.getState()
    const on = st.mode === 'thrown'
    k.current += ((on ? 1 : 0) - k.current) * Math.min(1, 10 * dt)
    t.current += dt
    const g = group.current
    if (!g || !refs.bro) return
    g.visible = k.current > 0.02
    g.position.copy(refs.bro.position)
    g.position.y += 1
    const gl = LOCKON.glow
    const pulse = 1 + 0.12 * Math.sin(t.current * 22)
    core.current.scale.setScalar(gl.coreRadius * k.current * pulse)
    halo.current.scale.setScalar(gl.haloRadius * k.current * (2 - pulse))
    ;(halo.current.material as THREE.MeshBasicMaterial).opacity = 0.45 * k.current
    ;(core.current.material as THREE.MeshBasicMaterial).opacity = 0.95 * k.current
  })

  const gl = LOCKON.glow
  const active = useGame((s) => s.mode) === 'thrown'
  return (
    <group>
      <group ref={group} visible={false}>
        <mesh ref={core}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshBasicMaterial color={gl.coreColor} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh ref={halo}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshBasicMaterial color={gl.color} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
      {bro && (
        <>
          {/* 芯：細く白い / 外：太く色つき。どちらも加算合成で光る */}
          <SmokeRibbon source={bro} color={gl.coreColor} points={gl.trailPoints} width={gl.trailWidth * 0.35} opacity={gl.trailOpacity} additive active={active} offsetY={1} />
          <SmokeRibbon source={bro} color={gl.color} points={gl.trailPoints} width={gl.trailWidth} opacity={gl.trailOpacity * 0.6} additive active={active} offsetY={1} />
        </>
      )}
    </group>
  )
}
