import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { on, emit } from '../systems/events'
import { useGame } from '../systems/store'
import { refs } from '../systems/refs'
import * as THREE from 'three'
import { STAGE, GAME } from '../config/game'
import { toonGradient } from '../systems/toon'
import { useStageKit, type KitType } from '../systems/stageKit'

const HOUSE_PALETTE = ['#e8dcc8', '#f0e6d2', '#dcd0b8', '#e6d8c0', '#f2ead8']
const ROOF_COLORS = ['#b5432f', '#4a5d8a', '#6b7a4a', '#8a5a3a']
/** type: -1 = 箱（＋屋根）、0 以上 = 外部モデル（KitType の添字）。scale は外部モデルの倍率 */
type Building = { x: number; z: number; w: number; h: number; d: number; color: string; roof?: boolean; roofColor?: string; type: number; scale: number; yaw: number }

/**
 * 格子状のレトロな街。道路の格子＋ブロックごとにビル群。妹はどこでも歩ける。
 * 建物は InstancedMesh で描画（数百棟でも軽い）。外部モデル（Kenney）があればそれを使い、無ければ箱。
 */
export function Stage() {
  const kit = useStageKit()
  const { buildings, roadsX, roadsZ } = useMemo(() => {
    let seed = 1234
    const rnd = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    const kinds = (kind: KitType['kind']) => (kit ?? []).map((k, i) => ({ k, i })).filter((x) => x.k.kind === kind)
    const houseTypes = kinds('house')
    const buildingTypes = kinds('building')
    const towerTypes = kinds('skyscraper')
    const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]
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
            // 区間で見た目を変える：住宅街（z < -500）は屋根付きの低い家、ビル街は高層
            const section = GAME.sections.find((sc) => cz >= sc.from && cz < sc.to)?.name
            if (section === '住宅街') {
              // 1 区画を 2×2 の家に分ける
              for (let hi = 0; hi < 2; hi++)
                for (let hj = 0; hj < 2; hj++) {
                  if (rnd() < 0.2) continue
                  const hw = cw * 0.32
                  const hd = cd * 0.32
                  const hx = cx + (hi - 0.5) * cw * 0.5
                  const hz = cz + (hj - 0.5) * cd * 0.5
                  const color = HOUSE_PALETTE[Math.floor(rnd() * HOUSE_PALETTE.length)]
                  if (houseTypes.length) {
                    // 外部モデル：マスに収まる倍率で置く（高さはモデルなり）。向きは道路側へ 2 択
                    const t = pick(houseTypes)
                    const yaw = hi === 0 ? Math.PI / 2 : -Math.PI / 2
                    const sx = t.k.size.z // 90 度回すので幅と奥行が入れ替わる
                    const sz = t.k.size.x
                    const s = Math.min(hw / sx, hd / sz) * STAGE.kit.houseFill
                    buildings.push({ x: hx, z: hz, w: sx * s, d: sz * s, h: t.k.size.y * s, color, type: t.i, scale: s, yaw })
                  } else {
                    buildings.push({
                      x: hx,
                      z: hz,
                      w: hw,
                      d: hd,
                      h: 6 + rnd() * 5,
                      color,
                      roof: true,
                      roofColor: ROOF_COLORS[Math.floor(rnd() * ROOF_COLORS.length)],
                      type: -1,
                      scale: 1,
                      yaw: 0,
                    })
                  }
                }
              continue
            }
            const w = cw * (0.55 + rnd() * 0.3)
            const d = cd * (0.55 + rnd() * 0.3)
            const cityBoost = section === 'ビル街' ? 1.6 : 1
            const tall = rnd() < STAGE.towerChance * cityBoost * 2
            const h = tall
              ? STAGE.buildingMax + rnd() * (STAGE.towerMax - STAGE.buildingMax)
              : (STAGE.buildingMin + rnd() * (STAGE.buildingMax - STAGE.buildingMin)) * cityBoost
            const color = palette[Math.floor(rnd() * palette.length)]
            const types = tall ? towerTypes : buildingTypes
            if (types.length) {
              // 外部モデル：狙いの高さに合わせ、マスからはみ出さない倍率で
              const t = pick(types)
              const s = Math.min(h / t.k.size.y, w / t.k.size.x, d / t.k.size.z)
              const yaw = rnd() < 0.5 ? 0 : Math.PI
              buildings.push({ x: cx, z: cz, w: t.k.size.x * s, d: t.k.size.z * s, h: t.k.size.y * s, color, type: t.i, scale: s, yaw })
            } else {
              buildings.push({ x: cx, z: cz, w, d, h, color, type: -1, scale: 1, yaw: 0 })
            }
          }
        }
      }
    }
    const roads: number[] = []
    for (let i = 0; i <= n; i++) roads.push(-half + i * B)
    return { buildings, roadsX: roads, roadsZ: roads }
  }, [kit])

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
      {/* 外部モデルの読み込み中は建物を出さない（読めなければ箱） */}
      {kit && <Buildings list={buildings} kit={kit} />}
      {kit && <Roofs list={buildings} />}
      <School />
    </group>
  )
}

/**
 * 建物。妹の一歩で足元の建物が潰れる（インスタンスの高さを縮める）。
 * 種類（箱／外部モデルの各種）ごとに InstancedMesh を 1 つ持ち、建物の添字 → (メッシュ, その中の番号) で更新する。
 */
function Buildings({ list, kit }: { list: Building[]; kit: KitType[] }) {
  const crushed = useRef<Map<number, number>>(new Map()) // index → 経過秒
  const o = useMemo(() => new THREE.Object3D(), [])
  /** 建物 1 棟のインスタンス行列。k = 潰れ具合 0..1 */
  const place = (b: Building, k: number) => {
    if (b.type < 0) {
      const h = b.h * (1 - 0.92 * k)
      o.position.set(b.x, h / 2, b.z)
      o.rotation.set(0, 0, 0)
      o.scale.set(b.w * (1 + 0.15 * k), h, b.d * (1 + 0.15 * k))
    } else {
      const s = b.scale
      o.position.set(b.x, 0, b.z)
      o.rotation.set(0, b.yaw, 0)
      o.scale.set(s * (1 + 0.15 * k), s * (1 - 0.92 * k), s * (1 + 0.15 * k))
    }
    o.updateMatrix()
    return o.matrix
  }
  const { meshes, slot } = useMemo(() => {
    const byType = new Map<number, number[]>()
    list.forEach((b, i) => {
      const arr = byType.get(b.type) ?? []
      arr.push(i)
      byType.set(b.type, arr)
    })
    const meshes: THREE.InstancedMesh[] = []
    const slot = new Map<number, [THREE.InstancedMesh, number]>()
    const c = new THREE.Color()
    byType.forEach((idxs, type) => {
      const geo = type < 0 ? new THREE.BoxGeometry(1, 1, 1) : kit[type].geometry
      const mat = type < 0 ? new THREE.MeshToonMaterial({ gradientMap: toonGradient() }) : kit[type].material
      const m = new THREE.InstancedMesh(geo, mat, idxs.length)
      idxs.forEach((bi, li) => {
        const b = list[bi]
        m.setMatrixAt(li, place(b, 0))
        if (type < 0) m.setColorAt(li, c.set(b.color))
        slot.set(bi, [m, li])
      })
      m.castShadow = true
      m.receiveShadow = true
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
      meshes.push(m)
    })
    return { meshes, slot }
  }, [list, kit]) // eslint-disable-line react-hooks/exhaustive-deps

  const broken = useRef<Set<number>>(new Set())
  const bodyClock = useRef(0)

  /** 足元円内の建物を潰す／砕く。低い建物はぺちゃんこ、高い建物はブロックに砕ける */
  const hitBuildings = (x: number, z: number, r: number) => {
    let n = 0
    list.forEach((b, i) => {
      if (crushed.current.has(i) || broken.current.has(i)) return
      const dx = Math.max(Math.abs(x - b.x) - b.w / 2, 0)
      const dz = Math.max(Math.abs(z - b.z) - b.d / 2, 0)
      if (Math.hypot(dx, dz) >= r) return
      n++
      if (b.h <= GAME.stompHeight) {
        crushed.current.set(i, 0)
        // 音用（id -1 は建物）。見た目は building.crush 側（屋根が飛ぶ・壁の破片・砂煙）
        emit('enemy.hit', { id: -1, x: b.x, y: 4, z: b.z })
        emit('building.crush', { x: b.x, z: b.z, w: b.w, h: b.h, d: b.d, color: b.color, roofColor: b.roofColor })
      } else {
        broken.current.add(i)
        const s = slot.get(i)
        if (s) {
          o.position.set(b.x, 0, b.z)
          o.rotation.set(0, 0, 0)
          o.scale.set(0.0001, 0.0001, 0.0001)
          o.updateMatrix()
          s[0].setMatrixAt(s[1], o.matrix)
          s[0].instanceMatrix.needsUpdate = true
        }
        emit('building.break', { x: b.x, z: b.z, w: b.w, h: b.h, d: b.d, color: b.color })
      }
    })
    if (n > 0) useGame.getState().addScore(-GAME.crushPenalty * n)
  }

  useEffect(() => on('imouto.step', ({ x, z }) => hitBuildings(x, z, GAME.crushRadius)), [list]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    // 体（胴）に当たった建物も壊す
    bodyClock.current += dt
    if (bodyClock.current > 0.12 && refs.imouto) {
      bodyClock.current = 0
      hitBuildings(refs.imouto.position.x, refs.imouto.position.z, GAME.bodyRadius)
    }
    if (crushed.current.size === 0) return
    const dirty = new Set<THREE.InstancedMesh>()
    crushed.current.forEach((t, i) => {
      if (t >= GAME.crushSec) return
      const nt = Math.min(GAME.crushSec, t + dt)
      crushed.current.set(i, nt)
      const s = slot.get(i)
      if (!s) return
      s[0].setMatrixAt(s[1], place(list[i], nt / GAME.crushSec))
      dirty.add(s[0])
    })
    dirty.forEach((m) => (m.instanceMatrix.needsUpdate = true))
  })
  return (
    <group>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  )
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
      {/* 校舎（大きな本館。パイロット版：遠くからでも目印になる） */}
      <mesh position={[0, sc.height / 2, sc.z]} castShadow receiveShadow>
        <boxGeometry args={[sc.width, sc.height, sc.depth]} />
        <meshToonMaterial color="#e9e4d8" gradientMap={grad} />
      </mesh>
      {/* 窓の帯（階ごと） */}
      {Array.from({ length: Math.max(1, Math.floor(sc.height / 8)) }, (_, i) => (
        <mesh key={`w${i}`} position={[0, 5 + i * 8, sc.z - sc.depth / 2 - 0.3]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[sc.width * 0.92, 3.2]} />
          <meshBasicMaterial color="#8fb7d6" />
        </mesh>
      ))}
      {/* 両翼（左右の校舎） */}
      {[-1, 1].map((sgn) => (
        <mesh key={`wing${sgn}`} position={[sgn * (sc.width / 2 + 40), sc.height * 0.3, sc.z + 40]} castShadow receiveShadow>
          <boxGeometry args={[90, sc.height * 0.6, sc.depth + 80]} />
          <meshToonMaterial color="#e2dccd" gradientMap={grad} />
        </mesh>
      ))}
      {/* 時計塔 */}
      <mesh position={[0, sc.height + sc.towerHeight / 2, sc.z]} castShadow>
        <boxGeometry args={[30, sc.towerHeight, 30]} />
        <meshToonMaterial color="#d8d0c0" gradientMap={grad} />
      </mesh>
      <mesh position={[0, sc.height + sc.towerHeight * 0.6, sc.z - 15.5]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[10, 24]} />
        <meshBasicMaterial color="#fff" />
      </mesh>
      {/* 体育館 */}
      <mesh position={[sc.width / 2 + 160, 14, sc.z - 30]} castShadow receiveShadow>
        <boxGeometry args={[110, 28, 70]} />
        <meshToonMaterial color="#cfd6d8" gradientMap={grad} />
      </mesh>
    </group>
  )
}

/** 住宅街の屋根（四角錐）。家が潰れたら（building.crush）その屋根は消し、Debris 側で吹き飛ぶ屋根に置き換える */
function Roofs({ list }: { list: Building[] }) {
  const houses = useMemo(() => list.filter((b) => b.roof), [list])
  const mesh = useMemo(() => {
    const geo = new THREE.ConeGeometry(1, 1, 4)
    const mat = new THREE.MeshToonMaterial({ gradientMap: toonGradient() })
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, houses.length))
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    houses.forEach((b, i) => {
      o.position.set(b.x, b.h + b.w * 0.22, b.z)
      o.rotation.set(0, Math.PI / 4, 0)
      o.scale.set(b.w * 0.78, b.w * 0.45, b.d * 0.78)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c.set(b.roofColor ?? ROOF_COLORS[i % ROOF_COLORS.length]))
    })
    m.count = houses.length
    m.castShadow = true
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    return m
  }, [houses])
  useEffect(() => {
    const index = new Map<string, number>()
    houses.forEach((b, i) => index.set(`${b.x},${b.z}`, i))
    const o = new THREE.Object3D()
    return on('building.crush', ({ x, z }) => {
      const i = index.get(`${x},${z}`)
      if (i === undefined) return
      o.position.set(x, 0, z)
      o.scale.set(0.0001, 0.0001, 0.0001)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      mesh.instanceMatrix.needsUpdate = true
    })
  }, [houses, mesh])
  return <primitive object={mesh} />
}
