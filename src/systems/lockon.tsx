import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LOCKON, CAMERA, GAME, SOUND, BRO } from '../config/game'
import { enemies, lock } from './enemies'
import { useGame } from './store'
import { useInput } from './input'
import { refs } from './refs'
import { playVoice, seLock } from './audio'
import { emit } from './events'
import { projectiles } from './projectiles'
import { colliders, rayBuildings } from './colliders'
import { touchLookTick } from './mouse'

// デバッグ用（Playwright から狙いを付ける）
;(window as unknown as { __dbg: unknown }).__dbg = { refs, lock, enemies, input: useInput, emit, projectiles, colliders, cfg: { BRO, LOCKON, CAMERA, GAME } }

const proj = new THREE.Vector3()
const tmpV = new THREE.Vector3()
const ndc = new THREE.Vector3()
const rayHits: { i: number; t: number }[] = []

/**
 * ロックオン判定。溜め中（A 押下、肩上または地上）にサイト中心近くの敵を順にロックする。
 * サイトは溜め中にマウスで画面内を動く（パンツァードラグーン式）。画面端に寄るとカメラがその方向へ回る。
 * 画面座標のキャッシュは HUD のマーカー描画にも使う。
 */
export function LockonSystem() {
  const { camera, size } = useThree()
  // デバッグ用：カメラも見せる
  ;(window as unknown as { __dbg: { camera?: unknown } }).__dbg.camera = camera

  useFrame((_, dt) => {
    // タッチの仮想スティック（押している間、速さで回す）
    if (useGame.getState().phase === 'play') touchLookTick(dt)
    const st = useGame.getState()
    const a = useInput.getState().keys.a
    // ロックオンは肩上だけ（地上は高速タックル）
    const charging = st.mode === 'shoulder' && a && st.phase === 'play'
    if (charging !== st.charging) st.setCharging(charging)

    // サイトの位置：溜め中（と地上）は画面端でカメラを押す。それ以外は中央へ戻る
    const rc = LOCKON.reticle
    const groundAim = st.mode === 'ground' && st.phase === 'play' && rc.groundHorizontalOnly
    // 電撃の自動照準は地上と、肩上で溜めていない間（A を押して掴まれたら止まる）
    const aimOn = st.phase === 'play' && !charging && (st.mode === 'ground' || st.mode === 'shoulder')
    if (charging || groundAim) {
      const hx = size.width / 2
      const hy = size.height / 2
      const nx = refs.reticleX / hx
      const ny = refs.reticleY / hy
      const push = (n: number) => (Math.abs(n) > rc.edge ? Math.sign(n) * Math.min(1, (Math.abs(n) - rc.edge) / (1 - rc.edge)) : 0)
      const px = push(nx)
      const py = groundAim ? 0 : push(ny)
      if (px !== 0) refs.camYaw -= px * rc.pushSpeed * dt
      if (py !== 0) refs.camPitch = THREE.MathUtils.clamp(refs.camPitch + py * rc.pushSpeed * dt, CAMERA.pitchMin, CAMERA.pitchMax)
      if (groundAim) {
        refs.reticleY += (0 - refs.reticleY) * Math.min(1, rc.recenterLerp * dt)
        // カメラがサイトの方へ遅れて追いつく（サイトの画面位置はその分だけ中央へ戻す）
        const hfov = THREE.MathUtils.degToRad(CAMERA.ground.fov) * (size.width / size.height) * 0.5
        const turn = nx * hfov * 0.6 * Math.min(1, rc.groundFollow * dt)
        refs.camYaw -= turn
        refs.reticleX -= (turn / (hfov * 0.6)) * hx
      }
    } else {
      const k = Math.min(1, rc.recenterLerp * dt)
      refs.reticleX += (0 - refs.reticleX) * k
      refs.reticleY += (0 - refs.reticleY) * k
    }
    const cx = size.width / 2 + refs.reticleX
    const cy = size.height / 2 + refs.reticleY
    const toScreen = (p: THREE.Vector3): [number, number, boolean] => {
      proj.copy(p).project(camera)
      return [(proj.x * 0.5 + 0.5) * size.width, (-proj.y * 0.5 + 0.5) * size.height, proj.z < 1 && proj.z > -1]
    }
    // 兄の頭の画面位置（吹き出し用）
    if (refs.bro) refs.broScreen = toScreen(tmpV.copy(refs.bro.position).setY(refs.bro.position.y + 2.2))
    if (refs.head) refs.imoutoScreen = toScreen(refs.head.getWorldPosition(tmpV).setY(tmpV.y + 6))
    else if (refs.imouto) refs.imoutoScreen = toScreen(tmpV.copy(refs.imouto.position).setY(refs.imouto.position.y + 62))
    // 行き先（▼）：溜め中にサイトへ入ればロック。描画距離より遠くても同じ方向の近い点で画面位置を出す
    const d = GAME.dest
    tmpV.set(d.x, d.height, d.z).sub(camera.position)
    const far = (camera as THREE.PerspectiveCamera).far * 0.8
    if (tmpV.length() > far) tmpV.setLength(far)
    lock.destScreen = toScreen(tmpV.add(camera.position))
    if (GAME.dest.lockEnabled && charging && !lock.dest && lock.destScreen[2]) {
      const dx = (lock.destScreen[0] - cx) / size.height
      const dy = (lock.destScreen[1] - cy) / size.height
      if (Math.hypot(dx, dy) < LOCKON.reticleRadius) {
        lock.dest = true
        playVoice('se.lock', SOUND.lockVolume).then((ok) => {
          if (!ok) seLock(0)
        })
      }
    }

    lock.screen.clear()
    const camPos = camera.position
    // 地上：サイトが重なっている敵を探す（乗る用 rideTarget と電撃用 aimTarget）。一番サイトに近い 1 体。乗っている敵は除く
    let gtId = -1
    let gtBest = Infinity
    let aimId = -1
    let aimBest = Infinity
    const bro = refs.bro
    for (const e of enemies) {
      if (!e.alive) continue
      proj.copy(e.pos).project(camera)
      const inFront = proj.z < 1 && proj.z > -1
      const sx = (proj.x * 0.5 + 0.5) * size.width
      const sy = (-proj.y * 0.5 + 0.5) * size.height
      lock.screen.set(e.id, [sx, sy, inFront])
      if (aimOn && inFront && bro && e.id !== refs.riding) {
        const d = Math.hypot((sx - cx) / size.height, (sy - cy) / size.height)
        // 電撃の自動照準：高さ・距離を問わずサイトに一番近い敵
        if (d < BRO.lightning.aimRadius && d < aimBest) {
          aimBest = d
          aimId = e.id
        }
        // 乗る対象（地上だけ）：エネミービル以外
        if (groundAim && BRO.ride.enabled && e.kind !== 'boss' && d < BRO.ride.aimRadius && d < gtBest) {
          gtBest = d
          gtId = e.id
        }
      }
      if (!charging || !inFront) continue
      if (lock.ids.includes(e.id) || lock.ids.length >= LOCKON.maxLocks) continue
      if (e.pos.distanceTo(camPos) > LOCKON.maxRange) continue
      const dx = (sx - cx) / size.height
      const dy = (sy - cy) / size.height
      if (Math.hypot(dx, dy) < LOCKON.reticleRadius) {
        lock.ids.push(e.id)
        const index = lock.ids.length - 1
        playVoice('se.lock', SOUND.lockVolume).then((ok) => {
          if (!ok) seLock(index)
        })
      }
    }
    refs.rideTarget = groundAim ? gtId : -1
    refs.aimTarget = aimOn ? aimId : -1
    // 敵の弾（爆弾・ミサイル）も電撃の自動照準の対象。サイトに入っていれば敵より弾を優先
    let pjIdx = -1
    if (aimOn) {
      let best = BRO.lightning.aimRadius
      for (let i = 0; i < projectiles.length; i++) {
        const p = projectiles[i]
        if (p.dead) continue
        proj.copy(p.pos).project(camera)
        if (!(proj.z < 1 && proj.z > -1)) continue
        const sx = (proj.x * 0.5 + 0.5) * size.width
        const sy = (-proj.y * 0.5 + 0.5) * size.height
        const d = Math.hypot((sx - cx) / size.height, (sy - cy) / size.height)
        if (d < BRO.lightning.aimRadius && d < best) {
          best = d
          pjIdx = i
        }
      }
    }
    refs.aimProjectile = pjIdx
    // ビル：乗れる敵が無い時だけ、サイト中心と周りから何本かレイを放って当たったビルを探す（A で屋上へ跳ぶ）。minHeight 未満の住宅は対象外
    let roofIdx = -1
    const rj = BRO.roofJump
    if (rj.enabled && groundAim && gtId < 0) {
      // レイごとに「一番手前の建物」（見えている建物）だけを候補にし、候補の中から高い方（pick）を選ぶ。奥に隠れた建物は候補にしない
      const nRays = Math.max(1, Math.floor(rj.rays))
      let best = rj.pick === 'tallest' ? -Infinity : Infinity
      for (let r = 0; r < nRays; r++) {
        const ang = ((r - 1) / Math.max(1, nRays - 1)) * Math.PI * 2
        const ox = r === 0 ? 0 : Math.cos(ang) * rj.aimRadius * size.height
        const oy = r === 0 ? 0 : Math.sin(ang) * rj.aimRadius * size.height
        ndc.set(((cx + ox) / size.width) * 2 - 1, -(((cy + oy) / size.height) * 2 - 1), 0.5).unproject(camera).sub(camera.position).normalize()
        rayHits.length = 0
        rayBuildings(camera.position.x, camera.position.y, camera.position.z, ndc.x, ndc.y, ndc.z, 1e9, rj.minHeight, rayHits)
        let near: { i: number; t: number } | null = null
        for (const h of rayHits) if (!near || h.t < near.t) near = h
        if (!near) continue
        // 自分が乗っている建物と、近すぎる建物（minDist 以内）は対象外
        if (bro) {
          const c = colliders.list[near.i]
          const ddx = Math.max(Math.abs(bro.position.x - c.x) - c.w / 2, 0)
          const ddz = Math.max(Math.abs(bro.position.z - c.z) - c.d / 2, 0)
          if (Math.hypot(ddx, ddz) < rj.minDist) continue
        }
        const v = rj.pick === 'tallest' ? colliders.list[near.i].h : -near.t
        if (v > best) {
          best = v
          roofIdx = near.i
        }
      }
    }
    refs.roofTarget = roofIdx
    // ロック中の敵が死んだら外す
    for (let i = lock.ids.length - 1; i >= 0; i--) {
      const e = enemies.find((x) => x.id === lock.ids[i])
      if (!e || !e.alive) lock.ids.splice(i, 1)
    }
  })
  return null
}
