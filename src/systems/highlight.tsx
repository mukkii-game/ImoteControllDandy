import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BRO } from '../config/game'
import { enemyObjects, findRideable } from './enemies'
import { colliders } from './colliders'
import { refs } from './refs'
import { useGame } from './store'
import { POLICE, TANKS, FIGHTERS, HELIS } from '../config/waves'

/**
 * サイトが重なった相手の輪郭を光らせる（地上）。
 * - 敵（refs.rideTarget）：その敵のメッシュの複製をリムライトのマテリアルで重ねて描く（縁だけ光る）。見た目が無い敵（外部モデル無しの箱）は箱で代用
 * - ビル（refs.roofTarget）：建物の箱の辺（線）＋薄いリムの箱
 * xray.tsx の X 線輪郭と同じシェーダーだが、深度テストは普通（隠れていない部分の縁が光る）
 */
const TAG = '__hl'

function rimMaterial(color: string, intensity: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
    uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: 1.4 }, uIntensity: { value: intensity }, uPulse: { value: 1 } },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec3 p = position;
        vec3 n = normal;
        #ifdef USE_INSTANCING
          p = (instanceMatrix * vec4(position, 1.0)).xyz;
          n = mat3(instanceMatrix) * n;
        #endif
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * n);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uIntensity;
      uniform float uPulse;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
        gl_FragColor = vec4(uColor * uIntensity * uPulse, rim);
      }
    `,
  })
}

export function HighlightLayer() {
  const enemyMat = useMemo(() => rimMaterial(BRO.ride.highlightColor, BRO.ride.highlightIntensity), [])
  const roofMat = useMemo(() => rimMaterial(BRO.roofJump.highlightColor, 1.6), [])
  const clones = useRef<THREE.Object3D[]>([])
  const cloneOf = useRef(-1)
  const boxRef = useRef<THREE.Mesh>(null!)
  const roofBox = useRef<THREE.Mesh>(null!)
  const roofEdges = useRef<THREE.LineSegments>(null!)
  const time = useRef(0)

  useEffect(() => {
    return () => {
      for (const c of clones.current) c.parent?.remove(c)
      clones.current = []
      enemyMat.dispose()
      roofMat.dispose()
    }
  }, [enemyMat, roofMat])

  const clear = () => {
    for (const c of clones.current) c.parent?.remove(c)
    clones.current = []
    cloneOf.current = -1
  }

  useFrame((_, dt) => {
    time.current += dt
    const st = useGame.getState()
    const active = st.phase === 'play' && st.mode === 'ground'
    const pulse = 0.85 + 0.35 * Math.sin(time.current * 9)
    enemyMat.uniforms.uPulse.value = pulse
    roofMat.uniforms.uPulse.value = pulse
    // ---- 敵
    const id = active ? refs.rideTarget : -1
    const e = id >= 0 ? findRideable(id) : undefined
    const obj = e ? enemyObjects.get(e.id) : undefined
    if (!e || !obj) {
      if (cloneOf.current >= 0) clear()
    } else if (cloneOf.current !== e.id) {
      clear()
      const m = enemyMat
      obj.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh || mesh.userData[TAG] || mesh.userData.noXray) return
        const mt = mesh.material as THREE.Material
        if (!mt || mt.type === 'ShaderMaterial') return
        let dst: THREE.Mesh | THREE.InstancedMesh
        const im = mesh as THREE.InstancedMesh
        if (im.isInstancedMesh) {
          const d = new THREE.InstancedMesh(im.geometry, m, im.instanceMatrix.count)
          d.instanceMatrix = im.instanceMatrix
          d.count = im.count
          dst = d
        } else dst = new THREE.Mesh(mesh.geometry, m)
        dst.userData[TAG] = true
        dst.position.copy(mesh.position)
        dst.quaternion.copy(mesh.quaternion)
        dst.scale.copy(mesh.scale)
        dst.renderOrder = 21
        dst.frustumCulled = false
        mesh.parent?.add(dst)
        clones.current.push(dst)
      })
      cloneOf.current = e.id
    }
    // 見た目が無い敵（外部モデル無しの箱の警察・戦車）は、その大きさの箱で代用
    const box = boxRef.current
    const useBox = !!e && (!obj || clones.current.length === 0)
    box.visible = useBox
    if (useBox && e) {
      const s = e.kind === 'police' ? POLICE.size : e.kind === 'tank' ? TANKS.size : { w: 0, h: 0, d: 0 }
      const r = e.kind === 'fighter' ? FIGHTERS.size : e.kind === 'heli' ? HELIS.size : 0
      if (s.w > 0) box.scale.set(s.w * 1.08, s.h * 1.08, s.d * 1.08)
      else box.scale.setScalar(Math.max(4, r * 0.35))
      box.position.set(e.pos.x, s.w > 0 ? s.h / 2 : e.pos.y, e.pos.z)
    }
    // ---- ビル
    const ri = active ? refs.roofTarget : -1
    const b = ri >= 0 ? colliders.list[ri] : undefined
    const show = !!b && !b.dead
    roofBox.current.visible = show
    roofEdges.current.visible = show
    if (b && show) {
      roofBox.current.position.set(b.x, b.h / 2, b.z)
      roofBox.current.scale.set(b.w * 1.02, b.h * 1.02, b.d * 1.02)
      roofEdges.current.position.copy(roofBox.current.position)
      roofEdges.current.scale.copy(roofBox.current.scale)
    }
  })

  return (
    <group>
      <mesh ref={boxRef} visible={false} renderOrder={21} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={enemyMat} attach="material" />
      </mesh>
      <mesh ref={roofBox} visible={false} renderOrder={21} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={roofMat} attach="material" />
      </mesh>
      <lineSegments ref={roofEdges} visible={false} renderOrder={22} frustumCulled={false}>
        <edgesGeometry args={[new THREE.BoxGeometry(1, 1, 1)]} />
        <lineBasicMaterial color={BRO.roofJump.highlightColor} transparent opacity={0.95} depthTest={false} />
      </lineSegments>
    </group>
  )
}
