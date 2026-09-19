import { useMemo } from 'react'
import * as THREE from 'three'
import { STAGE, GAME } from '../config/game'
import { toonGradient } from '../systems/toon'

type Building = { x: number; z: number; w: number; h: number; d: number; color: string }

/**
 * 格子状のレトロな街。道路の格子＋ブロックごとにビル群。妹はどこでも歩ける。
 * 建物は InstancedMesh で描画（数百棟でも軽い）。
 */
export function Stage() {
  const { buildings, roadsX, roadsZ } = useMemo(() => {
    let seed = 1234
    const rnd = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    const palette = ['#c9b79c', '#a8b5c4', '#d7cfc0', '#b3a08c', '#8fa3a8', '#e0d2b4', '#9aa88f', '#c4a9a2']
    const n = STAGE.blocks
    const B = STAGE.blockSize
    const half = (n * B) / 2
    const buildings: Building[] = []
    for (let bx = 0; bx < n; bx++) {
      for (let bz = 0; bz < n; bz++) {
        const ox = -half + bx * B + STAGE.roadWidth / 2
        const oz = -half + bz * B + STAGE.roadWidth / 2
        const inner = B - STAGE.roadWidth
        // ブロック内を 2〜3 分割してビルを並べる
        const cols = 2 + Math.floor(rnd() * 2)
        const rows = 2 + Math.floor(rnd() * 2)
        const cw = inner / cols
        const cd = inner / rows
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            if (rnd() < 0.12) continue // 空き地
            const cx = ox + cw * (i + 0.5)
            const cz = oz + cd * (j + 0.5)
            // 公園と学校の敷地には建てない
            if (Math.abs(cx) < GAME.park.halfWidth && cz > GAME.park.from && cz < GAME.park.to) continue
            if (Math.abs(cx) < GAME.school.width / 2 + 60 && cz > GAME.gateZ - 40 && cz < GAME.school.z + 150) continue
            const w = cw * (0.55 + rnd() * 0.3)
            const d = cd * (0.55 + rnd() * 0.3)
            const dist = Math.hypot(ox + cw * (i + 0.5), oz + cd * (j + 0.5)) / half
            const tall = rnd() < STAGE.towerChance * (1.5 - dist)
            const h = tall
              ? STAGE.buildingMax + rnd() * (STAGE.towerMax - STAGE.buildingMax)
              : STAGE.buildingMin + rnd() * (STAGE.buildingMax - STAGE.buildingMin) * (1.2 - dist * 0.8)
            buildings.push({
              x: ox + cw * (i + 0.5),
              z: oz + cd * (j + 0.5),
              w,
              d,
              h,
              color: palette[Math.floor(rnd() * palette.length)],
            })
          }
        }
      }
    }
    const roads: number[] = []
    for (let i = 0; i <= n; i++) roads.push(-half + i * B)
    return { buildings, roadsX: roads, roadsZ: roads }
  }, [])

  const size = STAGE.blocks * STAGE.blockSize
  return (
    <group>
      {/* 地面 */}
      {/* 地面。巨大な1枚板は深度精度で道路と競合するので polygonOffset で奥に押す */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size * 2, size * 2, 8, 8]} />
        <meshToonMaterial color={STAGE.groundColor} gradientMap={toonGradient()} polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} />
      </mesh>
      {/* 道路（格子） */}
      {roadsX.map((x) => (
        <mesh key={`rx${x}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.15, 0]} receiveShadow>
          <planeGeometry args={[STAGE.roadWidth, size + STAGE.roadWidth]} />
          <meshToonMaterial color={STAGE.roadColor} gradientMap={toonGradient()} />
        </mesh>
      ))}
      {roadsZ.map((z) => (
        <mesh key={`rz${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, z]} receiveShadow>
          <planeGeometry args={[size + STAGE.roadWidth, STAGE.roadWidth]} />
          <meshToonMaterial color={STAGE.roadColor} gradientMap={toonGradient()} />
        </mesh>
      ))}
      {/* センターライン（縦方向だけ、距離感の目安） */}
      {roadsX.map((x) =>
        Array.from({ length: Math.floor(size / 16) }, (_, i) => (
          <mesh key={`l${x}_${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.25, -size / 2 + i * 16 + 4]}>
            <planeGeometry args={[0.8, 6]} />
            <meshBasicMaterial color="#e8dc90" />
          </mesh>
        )),
      )}
      <Buildings list={buildings} />
      <School />
    </group>
  )
}

function Buildings({ list }: { list: Building[] }) {
  const mesh = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const mat = new THREE.MeshToonMaterial({ gradientMap: toonGradient() })
    const m = new THREE.InstancedMesh(geo, mat, list.length)
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    list.forEach((b, i) => {
      o.position.set(b.x, b.h / 2, b.z)
      o.scale.set(b.w, b.h, b.d)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c.set(b.color))
    })
    m.castShadow = true
    m.receiveShadow = true
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    return m
  }, [list])
  return <primitive object={mesh} />
}

/** 校門・校舎・校庭。妹が校門の線（GAME.gateZ）を越えたらクリア */
function School() {
  const grad = toonGradient()
  const g = GAME
  const sc = g.school
  return (
    <group>
      {/* 校庭（土） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, (g.gateZ + sc.z) / 2]} receiveShadow>
        <planeGeometry args={[sc.width + 80, sc.z - g.gateZ + sc.depth]} />
        <meshToonMaterial color="#c9b58a" gradientMap={grad} />
      </mesh>
      {/* 校門：柱2本＋門扉 */}
      {[-1, 1].map((sgn) => (
        <mesh key={sgn} position={[sgn * g.gateHalfWidth, 6, g.gateZ]} castShadow>
          <boxGeometry args={[6, 12, 6]} />
          <meshToonMaterial color="#9c8f7a" gradientMap={grad} />
        </mesh>
      ))}
      <mesh position={[0, 11, g.gateZ]} castShadow>
        <boxGeometry args={[g.gateHalfWidth * 2, 1.5, 1.5]} />
        <meshToonMaterial color="#6b5f4e" gradientMap={grad} />
      </mesh>
      {/* 校舎（3 階建て） */}
      <mesh position={[0, sc.height / 2, sc.z]} castShadow receiveShadow>
        <boxGeometry args={[sc.width, sc.height, sc.depth]} />
        <meshToonMaterial color="#e9e4d8" gradientMap={grad} />
      </mesh>
      {/* 時計塔 */}
      <mesh position={[0, sc.height + 8, sc.z]} castShadow>
        <boxGeometry args={[14, 16, 14]} />
        <meshToonMaterial color="#d8d0c0" gradientMap={grad} />
      </mesh>
      <mesh position={[0, sc.height + 8, sc.z - sc.depth / 2 - 0.5]}>
        <circleGeometry args={[5, 24]} />
        <meshBasicMaterial color="#fff" />
      </mesh>
    </group>
  )
}
