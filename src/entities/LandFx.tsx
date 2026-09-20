import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BRO } from '../config/game'
import { on } from '../systems/events'

interface Ring {
  pos: THREE.Vector3
  t: number
}
const MAX = 8
const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
const s3 = new THREE.Vector3()

/** 屋上ジャンプの着地：兄の足元に黄色い波しぶきの輪が広がって消える（BRO.roofJump.landFx）。bro.land イベントで出す */
export function LandFx() {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const rings = useRef<Ring[]>([])
  useEffect(
    () =>
      on('bro.land', ({ x, y, z }) => {
        rings.current.push({ pos: new THREE.Vector3(x, y + 0.15, z), t: 0 })
        if (rings.current.length > MAX) rings.current.shift()
      }),
    [],
  )
  useFrame((_, dt) => {
    const fx = BRO.roofJump.landFx
    const list = rings.current
    for (let i = list.length - 1; i >= 0; i--) {
      list[i].t += dt
      if (list[i].t > fx.sec) list.splice(i, 1)
    }
    const m = mesh.current
    m.count = list.length
    list.forEach((r, i) => {
      const k = r.t / fx.sec
      const rad = fx.radius * (0.2 + 0.8 * Math.sqrt(k))
      s3.set(rad, rad, 1 + (1 - k) * 2)
      m4.compose(r.pos, q, s3)
      m.setMatrixAt(i, m4)
    })
    m.instanceMatrix.needsUpdate = true
    const mat = m.material as THREE.MeshBasicMaterial
    mat.opacity = list.length ? 0.9 * (1 - list[list.length - 1].t / fx.sec) : 0
  })
  const fx = BRO.roofJump.landFx
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX]} frustumCulled={false} renderOrder={15}>
      {/* 半径 1 の輪（内径 1-ring）。スケールで広げる */}
      <ringGeometry args={[1 - fx.ring, 1, 40]} />
      <meshBasicMaterial color={fx.color} transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
    </instancedMesh>
  )
}
