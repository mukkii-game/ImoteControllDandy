import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BOSS, BOSSES } from '../config/waves'
import { GAME } from '../config/game'
import { addEnemy, enemies, isStunned, type Enemy } from '../systems/enemies'
import { refs } from '../systems/refs'
import { emit, on } from '../systems/events'
import { toonGradient } from '../systems/toon'
import { useGame } from '../systems/store'

type BossCfg = (typeof BOSSES)[number]

interface BossState {
  cfg: BossCfg
  pos: THREE.Vector3
  yaw: number
  alive: boolean
  /** ロック点（ビルの中に散らばる。1 点＝1 ヒット） */
  points: Enemy[]
  offsets: THREE.Vector3[]
  hitsLeft: number
}

/** 看板のテクスチャ（店名を Canvas に描く） */
function signTexture(text: string, bg: string, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 192
  const ctx = c.getContext('2d')!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.fillStyle = color
  ctx.font = '900 130px "Rounded Mplus 1c", "M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Yu Gothic UI", "Noto Sans JP", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, c.width / 2, c.height / 2 + 6)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const tmp = new THREE.Vector3()

/**
 * エネミービル（ぎょうざの満洲・山田うどん）。妹と同じくらい大きいビルの形をした敵。
 * 妹が近づくとにじり寄り、通り抜けられない。ロック点 4 つ（ビルの中に散らばる）を全部当てると倒れる。技も効く。
 */
export function BossBuildings() {
  const grad = useMemo(() => toonGradient(), [])
  const state = useRef<BossState[]>(BOSSES.map((cfg) => ({ cfg, pos: new THREE.Vector3(cfg.x, 0, cfg.z), yaw: Math.PI, alive: true, points: [], offsets: [], hitsLeft: BOSS.hits })))
  const groups = useRef<THREE.Group[]>([])
  /** 上半分（屋上・顔・看板）の group：根元の傾きに加えてさらにしなる */
  const tops = useRef<THREE.Group[]>([])
  const swayT = useRef<number[]>([])
  const faces = useMemo(() => BOSSES.map((b) => {
    const t = new THREE.TextureLoader().load(b.image)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }), [])
  const signs = useMemo(() => BOSSES.map((b) => signTexture(b.name, b.signBg, b.signColor)), [])

  useEffect(() => {
    const created: Enemy[] = []
    for (const b of state.current) {
      b.points = []
      b.offsets = []
      for (let i = 0; i < BOSS.hits; i++) {
        const o = new THREE.Vector3((Math.random() - 0.5) * b.cfg.w * (1 - BOSS.pointInset), b.cfg.h * (0.2 + 0.65 * Math.random()), (Math.random() - 0.5) * b.cfg.d * (1 - BOSS.pointInset))
        const e = addEnemy('boss', b.pos.clone().add(o))
        b.points.push(e)
        b.offsets.push(o)
        created.push(e)
      }
    }
    const off = on('enemy.hit', ({ id }) => {
      for (const b of state.current) {
        if (!b.alive || !b.points.some((p) => p.id === id)) continue
        b.hitsLeft--
        if (b.hitsLeft <= 0) {
          b.alive = false
          for (const p of b.points) p.alive = false
          emit('building.break', { x: b.pos.x, z: b.pos.z, w: b.cfg.w, h: b.cfg.h, d: b.cfg.d, color: b.cfg.color })
          emit('building.crush', { x: b.pos.x, z: b.pos.z, w: b.cfg.w, h: b.cfg.h, d: b.cfg.d, color: b.cfg.signBg })
          useGame.getState().addScore(BOSS.score)
        }
      }
    })
    return () => {
      off()
      for (const e of created) {
        const i = enemies.indexOf(e)
        if (i >= 0) enemies.splice(i, 1)
      }
    }
  }, [])

  useFrame((_, dt) => {
    const im = refs.imouto
    if (!im) return
    const playing = useGame.getState().phase === 'play'
    const stunned = isStunned()
    state.current.forEach((b, i) => {
      const g = groups.current[i]
      if (!g) return
      g.visible = b.alive
      if (!b.alive) return
      const dx = im.position.x - b.pos.x
      const dz = im.position.z - b.pos.z
      const dist = Math.hypot(dx, dz)
      // 顔は常に妹（プレイヤー）の方へ
      if (dist > 1) b.yaw = Math.atan2(dx, dz)
      // にじり寄る
      if (playing && !stunned && dist < BOSS.aggroDist && dist > BOSS.stopDist) {
        b.pos.x += (dx / dist) * BOSS.creepSpeed * dt
        b.pos.z += (dz / dist) * BOSS.creepSpeed * dt
      }
      // 通り抜け不可：妹をビルの外へ押し出す
      const R = Math.max(b.cfg.w, b.cfg.d) / 2 + GAME.bodyRadius + 3
      if (dist < R && dist > 0.01) {
        im.position.x = b.pos.x + (dx / dist) * R
        im.position.z = b.pos.z + (dz / dist) * R
      }
      g.position.copy(b.pos)
      g.rotation.y = b.yaw
      // 体を左右に揺らしながら近づく（根元で傾き、上半分はさらにしなる）。近づいている間だけ大きく揺れる
      const creeping = playing && !stunned && dist < BOSS.aggroDist && dist > BOSS.stopDist
      const sw = BOSS.sway
      swayT.current[i] = (swayT.current[i] ?? 0) + dt * sw.speed * (creeping ? 1 : 0.35)
      const tilt = Math.sin(swayT.current[i] + i * 1.7) * sw.amp * (creeping ? 1 : 0.4)
      g.rotation.z = tilt
      const top = tops.current[i]
      if (top) top.rotation.z = tilt * sw.bend
      // ロック点をビルに追従
      const c = Math.cos(b.yaw)
      const s = Math.sin(b.yaw)
      b.points.forEach((p, k) => {
        const o = b.offsets[k]
        tmp.set(c * o.x + s * o.z, o.y, -s * o.x + c * o.z)
        p.pos.copy(b.pos).add(tmp)
      })
    })
  })

  return (
    <group>
      {BOSSES.map((cfg, i) => {
        const fw = cfg.w * 0.86
        const fh = fw * cfg.imageAspect
        const faceY = cfg.h - fh / 2 - 2
        const signH = 9
        const signY = faceY - fh / 2 - signH / 2 - 2
        return (
          <group key={cfg.name} ref={(el) => el && (groups.current[i] = el)} position={[cfg.x, 0, cfg.z]}>
            <mesh position={[0, cfg.h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[cfg.w, cfg.h, cfg.d]} />
              <meshToonMaterial color={cfg.color} gradientMap={grad} />
            </mesh>
            {/* 上半分（屋上・顔・看板）：ビルの中ほどを支点にさらに傾いて「しなる」 */}
            <group ref={(el) => el && (tops.current[i] = el)} position={[0, cfg.h * 0.5, 0]}>
              {/* 屋上のふち */}
              <mesh position={[0, cfg.h * 0.5 + 1, 0]} castShadow>
                <boxGeometry args={[cfg.w + 3, 2, cfg.d + 3]} />
                <meshToonMaterial color={cfg.signBg} gradientMap={grad} />
              </mesh>
              {/* 顔（プレイヤー側の側面の上の方に大きく） */}
              <mesh position={[0, faceY - cfg.h * 0.5, cfg.d / 2 + 0.4]}>
                <planeGeometry args={[fw, fh]} />
                <meshBasicMaterial map={faces[i]} transparent alphaTest={0.1} />
              </mesh>
              {/* 看板（店名） */}
              <mesh position={[0, signY - cfg.h * 0.5, cfg.d / 2 + 0.4]}>
                <planeGeometry args={[cfg.w * 0.92, signH]} />
                <meshBasicMaterial map={signs[i]} />
              </mesh>
            </group>
            {/* 窓の帯 */}
            {Array.from({ length: 3 }, (_, r) => (
              <mesh key={r} position={[0, 6 + r * 7, cfg.d / 2 + 0.3]}>
                <planeGeometry args={[cfg.w * 0.85, 2.6]} />
                <meshBasicMaterial color="#8fb7d6" />
              </mesh>
            ))}
          </group>
        )
      })}
    </group>
  )
}
