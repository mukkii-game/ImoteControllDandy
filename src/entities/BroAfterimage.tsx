import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BRO, SCALE } from '../config/game'
import { refs } from '../systems/refs'
import { useGame } from '../systems/store'
import { SmokeRibbon } from '../systems/smoke'

interface Ghost {
  pos: THREE.Vector3
  yaw: number
  t: number
}

const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()
const s3 = new THREE.Vector3()
const eul = new THREE.Euler()

/**
 * 兄の残像と尾。ダッシュ（タックル）中と妹へ飛び乗る間、少し前の位置に薄い兄の形（カプセル）を残し、後ろへ光の尾を引く。
 */
export function BroAfterimage() {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const ghosts = useRef<Ghost[]>([])
  const spawnClock = useRef(0)
  const [bro, setBro] = useState<THREE.Object3D | null>(null)
  const active = useGame((s) => s.mode) === 'mounting'
  const [dash, setDash] = useState(false)
  const c = BRO.afterimage
  const MAX = 48

  useEffect(() => {
    const id = setInterval(() => {
      if (refs.bro) {
        setBro(refs.bro)
        clearInterval(id)
      }
    }, 100)
    return () => clearInterval(id)
  }, [])

  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: c.color, transparent: true, opacity: c.opacity, blending: THREE.AdditiveBlending, depthWrite: false }), [c.color, c.opacity])

  useFrame((_, dt) => {
    const b = refs.bro
    const on = !!b && (refs.broDash || useGame.getState().mode === 'mounting')
    if (on !== dash) setDash(on)
    if (on && b) {
      spawnClock.current += dt
      if (spawnClock.current >= c.spawnEvery) {
        spawnClock.current = 0
        ghosts.current.push({ pos: b.position.clone(), yaw: b.rotation.y, t: 0 })
        while (ghosts.current.length > MAX) ghosts.current.shift()
      }
    }
    ghosts.current = ghosts.current.filter((g) => (g.t += dt) < c.lifeSec)
    const m = mesh.current
    m.count = ghosts.current.length
    ghosts.current.forEach((g, i) => {
      const k = 1 - g.t / c.lifeSec
      q.setFromEuler(eul.set(0, g.yaw, 0))
      s3.set(SCALE.broHeight * 0.32 * k, SCALE.broHeight * 0.5, SCALE.broHeight * 0.32 * k)
      m4.compose(s3.set(g.pos.x, g.pos.y + SCALE.broHeight * 0.5, g.pos.z), q, s3.clone().set(SCALE.broHeight * 0.32 * k + 0.001, SCALE.broHeight * 0.5, SCALE.broHeight * 0.32 * k + 0.001))
      m.setMatrixAt(i, m4)
    })
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, MAX]} material={mat} frustumCulled={false}>
        <capsuleGeometry args={[1, 1, 3, 8]} />
      </instancedMesh>
      {bro && <SmokeRibbon source={bro} color={c.color} points={c.trailPoints} width={c.trailWidth} opacity={c.trailOpacity} additive active={dash || active} offsetY={SCALE.broHeight * 0.5} />}
    </group>
  )
}
