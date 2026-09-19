/**
 * 建物の当たり判定用の索引。Stage が登録し、兄のタックル／歩きの「建物で止まる」と、妹の踏み潰し判定が使う。
 * 全棟を毎回なめないよう、区画（セル）ごとに建物の添字を持つ。
 */
export interface Collider {
  x: number
  z: number
  w: number
  d: number
  h: number
  /** 潰れた／砕けた（通り抜けられる） */
  dead: boolean
}

export const colliders = {
  list: [] as Collider[],
  cell: 420,
  half: 0,
  index: new Map<string, number[]>(),
}

export function cellKey(cx: number, cz: number) {
  return `${cx},${cz}`
}
export function cellOf(x: number, z: number): [number, number] {
  return [Math.floor((x + colliders.half) / colliders.cell), Math.floor((z + colliders.half) / colliders.cell)]
}

export function setBuildingColliders(list: Collider[], cell: number, half: number) {
  colliders.list = list
  colliders.cell = cell
  colliders.half = half
  colliders.index.clear()
  list.forEach((b, i) => {
    const [cx, cz] = cellOf(b.x, b.z)
    const k = cellKey(cx, cz)
    const arr = colliders.index.get(k) ?? []
    arr.push(i)
    colliders.index.set(k, arr)
  })
}

/** (x, z) の周り（隣接セルまで）の建物の添字 */
export function nearbyBuildings(x: number, z: number): number[] {
  const [cx, cz] = cellOf(x, z)
  const out: number[] = []
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++) {
      const arr = colliders.index.get(cellKey(cx + i, cz + j))
      if (arr) for (const b of arr) out.push(b)
    }
  return out
}

/** 半径 r の円が重なる（生きている）建物。無ければ null */
export function buildingAt(x: number, z: number, r: number): Collider | null {
  for (const i of nearbyBuildings(x, z)) {
    const b = colliders.list[i]
    if (b.dead) continue
    const dx = Math.max(Math.abs(x - b.x) - b.w / 2, 0)
    const dz = Math.max(Math.abs(z - b.z) - b.d / 2, 0)
    if (Math.hypot(dx, dz) < r) return b
  }
  return null
}
