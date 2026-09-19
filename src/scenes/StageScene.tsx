import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { CAMERA, SCALE, STAGE } from '../config/game'
import { useGame } from '../systems/store'
import { Helis } from '../entities/Helis'
import { BossBuildings } from '../entities/BossBuildings'
import { BroGlow } from '../entities/BroGlow'

/** 開始後しばらく fps を測り、低ければ影を切って解像度を 1 倍にする（自動の軽量化） */
function AutoQuality() {
  const gl = useThree((s) => s.gl)
  const setDpr = useThree((s) => s.setDpr)
  const acc = useRef({ t: 0, n: 0, warm: 0, done: false })
  useFrame((_, dt) => {
    const a = acc.current
    if (a.done || useGame.getState().phase !== 'play') return
    a.warm += dt
    if (a.warm < 3) return // 読み込み直後は測らない
    a.t += dt
    a.n++
    if (a.t >= 5) {
      const fps = a.n / a.t
      a.done = true
      if (fps < STAGE.autoLiteFps) {
        gl.shadowMap.enabled = false
        setDpr(1)
        console.info(`fps ${fps.toFixed(0)}：重いので影を切り、解像度を 1 倍にしました`)
      }
    }
  })
  return null
}

/** Esc（調整パネル）中はフレームループを止めてポーズ */
function PauseControl() {
  const paused = useGame((s) => s.tuneOpen)
  const set = useThree((s) => s.set)
  const clock = useThree((s) => s.clock)
  useEffect(() => {
    if (paused) set({ frameloop: 'never' })
    else {
      clock.getDelta() // 止まっていた時間を次のフレームに渡さない
      set({ frameloop: 'always' })
    }
  }, [paused, set, clock])
  return null
}
import { Imouto } from '../entities/Imouto'
import { Bro } from '../entities/Bro'
import { CameraRig } from '../systems/camera'
import { Stage } from './Stage'
import { ShadowFollower } from '../systems/shadow'
import { Explosions } from '../entities/Enemies'
import { Fighters } from '../entities/Fighters'
import { GroundEnemies } from '../entities/GroundEnemies'
import { Shoe } from '../entities/Shoe'
import { Debris } from '../entities/Debris'
import { GameFlow } from '../systems/flow'
import { LockonSystem } from '../systems/lockon'

/** ?lite：影なし・解像度 1 倍・外部モデルなし（低スペック機・自動テスト用） */
const LITE = location.search.includes('lite')

export function StageScene() {
  const H = SCALE.imoutoHeight
  return (
    <Canvas
      shadows={!LITE}
      camera={{ fov: CAMERA.ground.fov, near: CAMERA.near, far: CAMERA.far, position: [0, 2, 70] }}
      dpr={LITE ? 1 : [1, 1.25]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[STAGE.skyColor]} />
      <fog attach="fog" args={[STAGE.fogColor, 300, CAMERA.far]} />
      <ambientLight intensity={0.7} />
      <hemisphereLight args={['#fff2d0', '#6a7a4a', 0.5]} />
      <ShadowFollower size={H * 1.6} />
      <Stage />
      <Imouto />
      <Bro />
      <Fighters />
      <Helis />
      <GroundEnemies />
      <BossBuildings />
      <BroGlow />
      <Shoe />
      <Debris />
      <Explosions />
      <LockonSystem />
      <CameraRig />
      <GameFlow />
      <PauseControl />
      <AutoQuality />
    </Canvas>
  )
}
