import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LOCKON, CAMERA } from '../config/game'
import { enemies, lock } from './enemies'
import { useGame } from './store'
import { useInput } from './input'
import { refs } from './refs'
import { playVoice, seLock } from './audio'

// デバッグ用（Playwright から狙いを付ける）
;(window as unknown as { __dbg: unknown }).__dbg = { refs, lock, enemies }

const proj = new THREE.Vector3()

/**
 * ロックオン判定。溜め中（A 押下、肩上または地上）にサイト中心近くの敵を順にロックする。
 * サイトは溜め中にマウスで画面内を動く（パンツァードラグーン式）。画面端に寄るとカメラがその方向へ回る。
 * 画面座標のキャッシュは HUD のマーカー描画にも使う。
 */
export function LockonSystem() {
  const { camera, size } = useThree()

  useFrame((_, dt) => {
    const st = useGame.getState()
    const a = useInput.getState().keys.a
    const charging = (st.mode === 'shoulder' || st.mode === 'ground') && a && st.phase === 'play'
    if (charging !== st.charging) st.setCharging(charging)

    // サイトの位置：溜め中は画面端でカメラを押す。溜めていない時は中央へ戻る
    const rc = LOCKON.reticle
    if (charging) {
      const hx = size.width / 2
      const hy = size.height / 2
      const nx = refs.reticleX / hx
      const ny = refs.reticleY / hy
      const push = (n: number) => (Math.abs(n) > rc.edge ? Math.sign(n) * ((Math.abs(n) - rc.edge) / (1 - rc.edge)) : 0)
      const px = push(nx)
      const py = push(ny)
      if (px !== 0) refs.camYaw -= px * rc.pushSpeed * dt
      if (py !== 0) refs.camPitch = THREE.MathUtils.clamp(refs.camPitch + py * rc.pushSpeed * dt, CAMERA.pitchMin, CAMERA.pitchMax)
    } else {
      const k = Math.min(1, rc.recenterLerp * dt)
      refs.reticleX += (0 - refs.reticleX) * k
      refs.reticleY += (0 - refs.reticleY) * k
    }
    const cx = size.width / 2 + refs.reticleX
    const cy = size.height / 2 + refs.reticleY

    lock.screen.clear()
    const camPos = camera.position
    for (const e of enemies) {
      if (!e.alive) continue
      proj.copy(e.pos).project(camera)
      const inFront = proj.z < 1 && proj.z > -1
      const sx = (proj.x * 0.5 + 0.5) * size.width
      const sy = (-proj.y * 0.5 + 0.5) * size.height
      lock.screen.set(e.id, [sx, sy, inFront])
      if (!charging || !inFront) continue
      if (lock.ids.includes(e.id) || lock.ids.length >= LOCKON.maxLocks) continue
      if (e.pos.distanceTo(camPos) > LOCKON.maxRange) continue
      const dx = (sx - cx) / size.height
      const dy = (sy - cy) / size.height
      if (Math.hypot(dx, dy) < LOCKON.reticleRadius) {
        lock.ids.push(e.id)
        const index = lock.ids.length - 1
        playVoice('se.lock').then((ok) => {
          if (!ok) seLock(index)
        })
      }
    }
    // ロック中の敵が死んだら外す
    for (let i = lock.ids.length - 1; i >= 0; i--) {
      const e = enemies.find((x) => x.id === lock.ids[i])
      if (!e || !e.alive) lock.ids.splice(i, 1)
    }
  })
  return null
}
