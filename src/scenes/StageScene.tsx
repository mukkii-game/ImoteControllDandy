import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { CAMERA, SCALE, STAGE, QUALITY } from '../config/game'
import { useQuality, preset, effectiveDpr } from '../systems/quality'
import { useGame } from '../systems/store'
import { Helis } from '../entities/Helis'
import { BossBuildings } from '../entities/BossBuildings'
import { BroGlow } from '../entities/BroGlow'
import { Vulcan } from '../entities/Vulcan'
import { Tears } from '../entities/Tears'
import { Projectiles } from '../entities/Projectiles'
import { XrayLayer } from '../systems/xray'
import { BroAfterimage } from '../entities/BroAfterimage'

/**
 * 品質プリセットの適用：影の有無・描画解像度（最大フルHD）を反映し、auto なら開始後しばらく fps を測って低／中／高を決める
 */
function AutoQuality() {
  const gl = useThree((s) => s.gl)
  const setDpr = useThree((s) => s.setDpr)
  const version = useQuality((s) => s.version)
  const acc = useRef({ t: 0, n: 0, warm: 0 })
  // プリセットが変わったら影と解像度を反映
  useEffect(() => {
    const p = preset()
    gl.shadowMap.enabled = p.shadows
    gl.shadowMap.needsUpdate = true
    setDpr(effectiveDpr())
    const onResize = () => setDpr(effectiveDpr())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [version, gl, setDpr])
  useFrame((_, dt) => {
    const q = useQuality.getState()
    if (q.autoDone || q.choice !== 'auto' || useGame.getState().phase !== 'play') return
    const a = acc.current
    a.warm += dt
    if (a.warm < QUALITY.auto.warmupSec) return // 読み込み直後は測らない
    a.t += dt
    a.n++
    if (a.t >= QUALITY.auto.measureSec) {
      const fps = a.n / a.t
      const level = fps < QUALITY.auto.lowBelow ? 'low' : fps < QUALITY.auto.midBelow ? 'mid' : 'high'
      useQuality.setState({ autoDone: true })
      if (level !== q.level) q.applyLevel(level)
      console.info(`fps ${fps.toFixed(0)}：品質を「${QUALITY.presets[level].label}」にしました`)
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
import { FIGHTERS } from '../config/waves'
import { GroundEnemies } from '../entities/GroundEnemies'
import { Shoe } from '../entities/Shoe'
import { Debris } from '../entities/Debris'
import { GameFlow } from '../systems/flow'
import { LockonSystem } from '../systems/lockon'

/** 品質は systems/quality.ts（?q=low|mid|high|auto、?lite は low）。プリセットが変わると街・ヘリ・影ライトは作り直す */
export function StageScene() {
  const H = SCALE.imoutoHeight
  const version = useQuality((s) => s.version)
  const p = preset()
  return (
    <Canvas
      shadows
      camera={{ fov: CAMERA.ground.fov, near: CAMERA.near, far: CAMERA.far, position: [0, 2, 70] }}
      dpr={effectiveDpr()}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[STAGE.skyColor]} />
      <fog attach="fog" args={[STAGE.fogColor, STAGE.fogNear, STAGE.fogFar]} />
      <ambientLight intensity={0.7} />
      <hemisphereLight args={['#fff2d0', '#6a7a4a', 0.5]} />
      <ShadowFollower key={`sh${version}`} size={H * 1.6} mapSize={p.shadowMapSize} />
      <Stage key={`st${version}`} />
      <Imouto />
      <Bro />
      {Array.from({ length: FIGHTERS.squadrons }, (_, i) => (
        <Fighters key={i} squad={i} />
      ))}
      <Helis key={`he${version}`} />
      <GroundEnemies />
      <BossBuildings />
      <BroGlow />
      <Vulcan />
      <Tears />
      <Projectiles />
      <XrayLayer />
      <BroAfterimage />
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
