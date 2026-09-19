import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 交差リボンのスモーク／光の軌跡。source の位置を毎フレーム先頭に追加し、後ろへ行くほど透明に。
 * 水平と垂直の2枚を交差させて、どの角度からも太く見せる。
 * additive=true で光る（加算合成）。active=false の間は履歴を捨てて描かない。
 */
export function SmokeRibbon({
  source,
  color,
  points,
  width,
  opacity = 0.75,
  additive = false,
  active = true,
  offsetY = 0,
  fadeSec = 0,
}: {
  source: THREE.Object3D
  color: string
  points: number
  width: number
  opacity?: number
  additive?: boolean
  active?: boolean
  offsetY?: number
  /** active=false になったあと、履歴を残したまま fadeSec 秒かけて薄れて消える（0 なら即消える） */
  fadeSec?: number
}) {
  const N = points
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    // 2 リボン × N × 2 頂点
    const pos = new Float32Array(2 * N * 2 * 3)
    const alpha = new Float32Array(2 * N * 2)
    const idx: number[] = []
    for (let r = 0; r < 2; r++) {
      const base = r * N * 2
      for (let i = 0; i < N - 1; i++) {
        const a = base + i * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1))
    g.setIndex(idx)
    return g
  }, [N])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
        vertexShader: `attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA * uOpacity); }`,
      }),
    [color, opacity, additive],
  )
  const hist = useRef<THREE.Vector3[]>([])
  const fade = useRef(0)
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dt) => {
    const h = hist.current
    const u = mat.uniforms.uOpacity
    if (!active) {
      if (fadeSec > 0 && h.length > 1 && fade.current < fadeSec) {
        // 止まった位置に軌跡を残したまま薄れて消える
        fade.current += dt
        u.value = opacity * Math.max(0, 1 - fade.current / fadeSec)
        return
      }
      if (h.length) h.length = 0
      geom.setDrawRange(0, 0)
      return
    }
    fade.current = 0
    u.value = opacity
    geom.setDrawRange(0, Infinity)
    const p = source.getWorldPosition(tmp).clone()
    p.y += offsetY
    if (h.length === 0 || h[0].distanceToSquared(p) > 1) h.unshift(p)
    if (h.length > N) h.length = N
    const pos = geom.attributes.position as THREE.BufferAttribute
    const al = geom.attributes.alpha as THREE.BufferAttribute
    const n = h.length
    for (let i = 0; i < N; i++) {
      const q = h[Math.min(i, n - 1)] ?? p
      const k = 1 - i / N
      const w = width * (0.4 + 0.6 * (1 - k)) // 後ろほど広がる
      const a = n > 1 ? k * k : 0
      // 水平リボン
      pos.setXYZ(i * 2, q.x - w, q.y, q.z)
      pos.setXYZ(i * 2 + 1, q.x + w, q.y, q.z)
      // 垂直リボン
      const b = N * 2
      pos.setXYZ(b + i * 2, q.x, q.y - w, q.z)
      pos.setXYZ(b + i * 2 + 1, q.x, q.y + w, q.z)
      al.setX(i * 2, a)
      al.setX(i * 2 + 1, a)
      al.setX(b + i * 2, a)
      al.setX(b + i * 2 + 1, a)
    }
    pos.needsUpdate = true
    al.needsUpdate = true
  })

  return <mesh geometry={geom} material={mat} frustumCulled={false} />
}
