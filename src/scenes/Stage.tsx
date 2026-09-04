import { useMemo } from 'react'
import { STAGE, SCALE } from '../config/game'

/** 一本道＋両脇の街。妹(60m)と比較できるよう、ビルは 10〜45m、家は 8m 程度。 */
export function Stage() {
  const buildings = useMemo(() => {
    const out: { x: number; z: number; w: number; h: number; d: number; color: string }[] = []
    let seed = 7
    const rnd = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    const palette = ['#9aa5b1', '#b8c0c8', '#8d99ae', '#cfd6dd', '#a3b18a', '#d9c5a0']
    for (let i = 0; i < STAGE.buildingRows; i++) {
      const z = i * STAGE.buildingSpacing - 100
      for (const side of [-1, 1]) {
        const isHouse = rnd() < 0.3
        const h = isHouse ? 6 + rnd() * 4 : 12 + rnd() * 33
        const w = isHouse ? 10 + rnd() * 6 : 18 + rnd() * 16
        const d = isHouse ? 10 + rnd() * 6 : 18 + rnd() * 16
        const x = side * (STAGE.roadWidth / 2 + w / 2 + 6 + rnd() * 20)
        out.push({ x, z, w, h, d, color: palette[Math.floor(rnd() * palette.length)] })
      }
    }
    return out
  }, [])

  return (
    <group>
      {/* 地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, STAGE.roadLength / 2 - 200]} receiveShadow>
        <planeGeometry args={[2000, STAGE.roadLength + 800]} />
        <meshStandardMaterial color={STAGE.groundColor} />
      </mesh>
      {/* 道路（妹は +Z 方向へ進む） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, STAGE.roadLength / 2 - 200]} receiveShadow>
        <planeGeometry args={[STAGE.roadWidth, STAGE.roadLength + 400]} />
        <meshStandardMaterial color={STAGE.roadColor} />
      </mesh>
      {/* センターライン（距離感の目安） */}
      {Array.from({ length: 60 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, i * 20 - 150]}>
          <planeGeometry args={[1.2, 8]} />
          <meshStandardMaterial color="#e8e0a0" />
        </mesh>
      ))}
      {/* 家（出発地点、妹の後ろ） */}
      <mesh position={[-50, 6, -45]} castShadow receiveShadow>
        <boxGeometry args={[26, 12, 20]} />
        <meshStandardMaterial color="#e6d3b3" />
      </mesh>
      <mesh position={[-50, 15, -45]} castShadow>
        <coneGeometry args={[20, 7, 4]} />
        <meshStandardMaterial color="#b5432f" />
      </mesh>
      {/* 街 */}
      {buildings.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]} castShadow receiveShadow>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial color={b.color} />
        </mesh>
      ))}
      {/* スケール比較用：兄と同じ 1.8m の人型ポール（道端） */}
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={`p${i}`} position={[STAGE.roadWidth / 2 + 2, SCALE.broHeight * 2.5, i * 80 - 60]} castShadow>
          <cylinderGeometry args={[0.15, 0.15, SCALE.broHeight * 5, 6]} />
          <meshStandardMaterial color="#666" />
        </mesh>
      ))}
    </group>
  )
}
