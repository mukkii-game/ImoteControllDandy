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

/** 半径 r の円が重なる（生きている）建物。無ければ null。aboveY を渡すと、その高さより高い建物だけ（屋上にいる時は自分の屋上を壁扱いしない） */
export function buildingAt(x: number, z: number, r: number, aboveY = -Infinity): Collider | null {
  for (const i of nearbyBuildings(x, z)) {
    const b = colliders.list[i]
    if (b.dead || b.h <= aboveY) continue
    const dx = Math.max(Math.abs(x - b.x) - b.w / 2, 0)
    const dz = Math.max(Math.abs(z - b.z) - b.d / 2, 0)
    if (Math.hypot(dx, dz) < r) return b
  }
  return null
}

/** (x, z) の床の高さ：その点を含む（生きている）建物のうち一番高い屋上。建物が無ければ 0（地面） */
export function floorAt(x: number, z: number): number {
  let h = 0
  for (const i of nearbyBuildings(x, z)) {
    const b = colliders.list[i]
    if (b.dead || b.h <= h) continue
    if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2) h = b.h
  }
  return h
}

/**
 * レイ（origin から dir 方向）に当たる（生きている）建物の添字と距離。箱（AABB）のスラブ判定。
 * 全棟をなめるが数千棟 × 数本なら毎フレームでも軽い。minH 未満の低い建物は無視
 */
export function rayBuildings(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number, minH: number, out: { i: number; t: number }[]) {
  const list = colliders.list
  const ix = 1 / dx
  const iy = 1 / dy
  const iz = 1 / dz
  for (let i = 0; i < list.length; i++) {
    const b = list[i]
    if (b.dead || b.h < minH) continue
    const hw = b.w / 2
    const hd = b.d / 2
    let t1 = (b.x - hw - ox) * ix
    let t2 = (b.x + hw - ox) * ix
    let tmin = Math.min(t1, t2)
    let tmax = Math.max(t1, t2)
    t1 = (0 - oy) * iy
    t2 = (b.h - oy) * iy
    tmin = Math.max(tmin, Math.min(t1, t2))
    tmax = Math.min(tmax, Math.max(t1, t2))
    t1 = (b.z - hd - oz) * iz
    t2 = (b.z + hd - oz) * iz
    tmin = Math.max(tmin, Math.min(t1, t2))
    tmax = Math.min(tmax, Math.max(t1, t2))
    if (tmax < Math.max(tmin, 0) || tmin > maxDist) continue
    out.push({ i, t: Math.max(tmin, 0) })
  }
}
