import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LOCKON } from '../config/game'
import { enemies, lock } from './enemies'
import { useGame } from './store'
import { useInput } from './input'
import { refs } from './refs'
import { playVoice, seLock } from './audio'

// デバッグ用（Playwright から狙いを付ける）
;(window as unknown as { __dbg: unknown }).__dbg = { refs, lock, enemies }

const proj = new THREE.Vector3()

/**
 * ロックオン判定。溜め中（A 押下、肩上）にサイト中心近くの敵を順にロックする。
 * 画面座標のキャッシュは HUD のマーカー描画にも使う。
 */
export function LockonSystem() {
  const { camera, size } = useThree()

  useFrame(() => {
    const st = useGame.getState()
    const a = useInput.getState().keys.a
    const charging = st.mode === 'shoulder' && a && st.phase === 'play'
    if (charging !== st.charging) st.setCharging(charging)

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
      const dx = (sx - size.width / 2) / size.height
      const dy = (sy - size.height / 2) / size.height
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
