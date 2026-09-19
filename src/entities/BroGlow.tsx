import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LOCKON } from '../config/game'
import { refs } from '../systems/refs'
import { useGame } from '../systems/store'
import { SmokeRibbon } from '../systems/smoke'

const m4 = new THREE.Matrix4()
const s3 = new THREE.Vector3()
const p3 = new THREE.Vector3()

/**
 * 光弾化した兄。攻撃中（thrown）は小さな光の芯＋薄いハロ＋周りを舞う光の粒（パーティクル）に包まれ、
 * 細めの光の軌跡を引く。画面を埋めすぎないように控えめ。
 */
export function BroGlow() {
  const group = useRef<THREE.Group>(null!)
  const core = useRef<THREE.Mesh>(null!)
  const halo = useRef<THREE.Mesh>(null!)
  const sparks = useRef<THREE.InstancedMesh>(null!)
  const [bro, setBro] = useState<THREE.Object3D | null>(null)
  const t = useRef(0)
  const k = useRef(0)
  const gl = LOCKON.glow
  // 粒ごとの軌道（半径・速さ・位相・大きさ）
  const orbits = useMemo(() => Array.from({ length: gl.sparkles }, () => ({ r: 0.35 + Math.random() * 0.65, sp: 2 + Math.random() * 4, ph: Math.random() * Math.PI * 2, tilt: Math.random() * Math.PI, sz: 0.5 + Math.random() })), [gl.sparkles])

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
    const pulse = 1 + 0.1 * Math.sin(t.current * 20)
    core.current.scale.setScalar(gl.coreRadius * k.current * pulse)
    halo.current.scale.setScalar(gl.haloRadius * k.current)
    ;(halo.current.material as THREE.MeshBasicMaterial).opacity = gl.haloOpacity * k.current
    ;(core.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * k.current
    // 粒：兄の周りを回りながら明滅
    const m = sparks.current
    m.count = orbits.length
    orbits.forEach((o, i) => {
      const a = t.current * o.sp + o.ph
      const r = gl.sparkleRadius * o.r * k.current
      p3.set(Math.cos(a) * r, Math.sin(a * 1.3 + o.tilt) * r * 0.6, Math.sin(a) * r)
      const tw = 0.5 + 0.5 * Math.sin(t.current * 9 + o.ph * 3)
      s3.setScalar(gl.sparkleSize * o.sz * tw * k.current + 0.001)
      m4.compose(p3, new THREE.Quaternion(), s3)
      m.setMatrixAt(i, m4)
    })
    m.instanceMatrix.needsUpdate = true
  })

  const active = useGame((s) => s.mode) === 'thrown'
  return (
    <group>
      <group ref={group} visible={false}>
        <mesh ref={core}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshBasicMaterial color={gl.coreColor} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh ref={halo}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshBasicMaterial color={gl.color} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <instancedMesh ref={sparks} args={[undefined, undefined, gl.sparkles]} frustumCulled={false}>
          <sphereGeometry args={[1, 6, 5]} />
          <meshBasicMaterial color={gl.coreColor} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
        </instancedMesh>
      </group>
      {bro && (
        <>
          <SmokeRibbon source={bro} color={gl.coreColor} points={gl.trailPoints} width={gl.trailWidth * 0.35} opacity={gl.trailOpacity} additive active={active} offsetY={1} />
          <SmokeRibbon source={bro} color={gl.color} points={gl.trailPoints} width={gl.trailWidth} opacity={gl.trailOpacity * 0.5} additive active={active} offsetY={1} />
        </>
      )}
    </group>
  )
}
