import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PROJECTILE, FIGHTERS } from '../config/waves'
import { projectiles } from '../systems/projectiles'

const MAX = 128
const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()
const s3 = new THREE.Vector3()
const p3 = new THREE.Vector3()
const dir = new THREE.Vector3()
const up = new THREE.Vector3(0, 1, 0)
const down = new THREE.Vector3(0, -1, 0)

/**
 * 登録簿にある敵の弾をまとめて描く。ミサイル（灰色の胴体＋赤い先端、進行方向を向く）と爆弾（黒い玉）、どちらも周りに光。
 * 持ち主（戦闘機・ヘリ・パトカー・戦車）は位置を動かすだけ
 */
export function Projectiles() {
  const body = useRef<THREE.InstancedMesh>(null!)
  const nose = useRef<THREE.InstancedMesh>(null!)
  const ball = useRef<THREE.InstancedMesh>(null!)
  const halo = useRef<THREE.InstancedMesh>(null!)
  const bc = FIGHTERS.bomb
  useFrame(() => {
    const pulse = 1 + 0.18 * Math.sin((performance.now() / 1000) * PROJECTILE.pulse)
    let nb = 0
    let nBall = 0
    let nh = 0
    for (const p of projectiles) {
      if (p.dead || nh >= MAX) continue
      if (p.kind === 'bomb') {
        s3.setScalar(bc.size)
        m4.compose(p.pos, q.identity(), s3)
        ball.current.setMatrixAt(nBall++, m4)
        const r = bc.haloSize * pulse
        m4.makeScale(r, r, r)
        m4.setPosition(p.pos)
        halo.current.setMatrixAt(nh++, m4)
      } else {
        // 胴体：進行方向に向けた円柱。先端：その前の円錐
        if (p.vel && p.vel.lengthSq() > 1) dir.copy(p.vel).normalize()
        else dir.copy(down)
        q.setFromUnitVectors(up, dir)
        const r = PROJECTILE.bodyRadius
        s3.set(r, r * PROJECTILE.bodyLength, r)
        m4.compose(p.pos, q, s3)
        body.current.setMatrixAt(nb, m4)
        p3.copy(p.pos).addScaledVector(dir, r * PROJECTILE.bodyLength * 0.5 + r * 0.9)
        s3.set(r, r * 1.8, r)
        m4.compose(p3, q, s3)
        nose.current.setMatrixAt(nb++, m4)
        const hr = PROJECTILE.haloRadius * pulse
        m4.makeScale(hr, hr, hr)
        m4.setPosition(p.pos)
        halo.current.setMatrixAt(nh++, m4)
      }
    }
    body.current.count = nb
    nose.current.count = nb
    ball.current.count = nBall
    halo.current.count = nh
    body.current.instanceMatrix.needsUpdate = true
    nose.current.instanceMatrix.needsUpdate = true
    ball.current.instanceMatrix.needsUpdate = true
    halo.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      <instancedMesh ref={body} args={[undefined, undefined, MAX]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 10]} />
        <meshStandardMaterial color={PROJECTILE.color} metalness={0.6} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={nose} args={[undefined, undefined, MAX]} frustumCulled={false}>
        <coneGeometry args={[1, 1, 10]} />
        <meshBasicMaterial color={PROJECTILE.noseColor} />
      </instancedMesh>
      <instancedMesh ref={ball} args={[undefined, undefined, MAX]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color={bc.color} />
      </instancedMesh>
      <instancedMesh ref={halo} args={[undefined, undefined, MAX]} frustumCulled={false} userData={{ noXray: true }}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color={PROJECTILE.haloColor} transparent opacity={PROJECTILE.haloOpacity} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
    </group>
  )
}
