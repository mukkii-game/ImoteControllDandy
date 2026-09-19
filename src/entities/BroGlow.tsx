import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LOCKON } from '../config/game'
import { refs } from '../systems/refs'
import { useGame } from '../systems/store'
import { on } from '../systems/events'
import { SmokeRibbon } from '../systems/smoke'

const m4 = new THREE.Matrix4()
const s3 = new THREE.Vector3()
const p3 = new THREE.Vector3()

/**
 * 光弾化した兄。攻撃中（thrown）は光の芯＋ハロ＋周りを舞う光の粒（パーティクル）に包まれ、
 * レーザーのような光の軌跡を引く。軌跡は戻ったあともフェードで消える（LOCKON.glow.trailFadeSec）。
 * 肩に戻った瞬間は着地エフェクト（広がるリング＋閃光、LOCKON.landFx）。
 */
export function BroGlow() {
  const group = useRef<THREE.Group>(null!)
  const core = useRef<THREE.Mesh>(null!)
  const halo = useRef<THREE.Mesh>(null!)
  const sparks = useRef<THREE.InstancedMesh>(null!)
  const land = useRef<THREE.Group>(null!)
  const landRing = useRef<THREE.Mesh>(null!)
  const landFlash = useRef<THREE.Mesh>(null!)
  const landT = useRef(Infinity)
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
  // 肩に戻った：着地エフェクト開始
  useEffect(
    () =>
      on('bro.return', () => {
        if (!refs.bro || !land.current) return
        land.current.position.copy(refs.bro.position)
        land.current.position.y += 1
        landT.current = 0
      }),
    [],
  )

  useFrame((_, dt) => {
    const st = useGame.getState()
    const flying = st.mode === 'thrown'
    k.current += ((flying ? 1 : 0) - k.current) * Math.min(1, 10 * dt)
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
    // 着地エフェクト：リングが広がりながら薄れ、閃光が縮む
    const lf = LOCKON.landFx
    const L = land.current
    if (L) {
      landT.current += dt
      const u = landT.current / lf.sec
      if (u >= 1) L.visible = false
      else {
        L.visible = true
        const ease = 1 - (1 - u) * (1 - u)
        landRing.current.scale.setScalar(Math.max(0.01, lf.radius * ease))
        ;(landRing.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - u)
        landFlash.current.scale.setScalar(Math.max(0.01, lf.radius * 0.5 * (1 - u)))
        ;(landFlash.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - u)
        L.lookAt(L.position.x, L.position.y + 1, L.position.z) // リングは水平
      }
    }
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
      <group ref={land} visible={false}>
        <mesh ref={landRing}>
          <torusGeometry args={[1, 0.06, 8, 40]} />
          <meshBasicMaterial color={gl.color} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh ref={landFlash}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial color={gl.coreColor} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
      {bro && (
        <>
          <SmokeRibbon source={bro} color={gl.coreColor} points={gl.trailPoints} width={gl.trailWidth * 0.35} opacity={gl.trailOpacity} additive active={active} offsetY={1} fadeSec={gl.trailFadeSec} />
          <SmokeRibbon source={bro} color={gl.color} points={gl.trailPoints} width={gl.trailWidth} opacity={gl.trailOpacity * 0.5} additive active={active} offsetY={1} fadeSec={gl.trailFadeSec} />
        </>
      )}
    </group>
  )
}
