import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { CAMERA, SCALE, STAGE, QUALITY } from '../config/game'
import { useQuality, preset, effectiveDpr } from '../systems/quality'
import { useGame } from '../systems/store'
import { Helis } from '../entities/Helis'
import { BossBuildings } from '../entities/BossBuildings'
import { BroGlow } from '../entities/BroGlow'
import { Lightning } from '../entities/Lightning'
import { Tears } from '../entities/Tears'
import { Projectiles } from '../entities/Projectiles'
import { XrayLayer } from '../systems/xray'
import { HighlightLayer } from '../systems/highlight'
import { BroAfterimage } from '../entities/BroAfterimage'

/**
 * 品質プリセットの適用：影の有無・描画解像度（最大フルHD）を反映し、auto なら開始後しばらく fps を測って低／中／高を決める
 */
function AutoQuality() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const setDpr = useThree((s) => s.setDpr)
  const version = useQuality((s) => s.version)
  // デバッグ用（描画回数・三角形数を Playwright から読む）と、使っている GPU 名の取得（タイトル画面・Esc パネルに出す）
  useEffect(() => {
    ;(window as unknown as { __gl: unknown; __scene: unknown }).__gl = gl
    ;(window as unknown as { __gl: unknown; __scene: unknown }).__scene = scene
    try {
      const ctx = gl.getContext()
      const ext = ctx.getExtension('WEBGL_debug_renderer_info')
      const name = String(ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER))
      useQuality.setState({ gpu: name })
      console.info('GPU:', name)
    } catch {
      /* ignore */
    }
  }, [gl, scene])
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

/**
 * シェーダーの先読みコンパイル：three.js は「初めて画面に映った」マテリアルをその場でコンパイルするので、
 * 最初に肩へ乗った時や敵が出た時に 0.5 秒くらい止まる。モデルが読めた時点（タイトル画面）でまとめてコンパイルしておく
 */
function Precompile() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const loaded = useGame((s) => s.loaded)
  const done = useRef(false)
  useEffect(() => {
    if (done.current || !loaded.imouto || !loaded.bro) return
    done.current = true
    const t0 = performance.now()
    gl.compileAsync(scene, camera)
      .then(() => console.info(`シェーダー先読み ${(performance.now() - t0).toFixed(0)} ms`))
      .catch(() => {})
  }, [loaded, gl, scene, camera])
  return null
}

/**
 * フレームループを自前で回す：品質プリセットの maxFps で上限を付け（120Hz のスマホで無駄に回さない、発熱を抑える）、
 * Esc（調整パネル）中は止めてポーズ
 */
function FrameLimiter() {
  const setFrameloop = useThree((s) => s.setFrameloop)
  const advance = useThree((s) => s.advance)
  const clock = useThree((s) => s.clock)
  useEffect(() => {
    // 'never' にすると R3F は時計を止め、advance(秒) で渡した時刻との差を dt にする
    setFrameloop('never')
    let raf = 0
    let last = -1
    let resync = true
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (useGame.getState().tuneOpen) {
        resync = true // 止まっていた時間を次のフレームに渡さない
        return
      }
      const minMs = 1000 / preset().maxFps - 1
      if (last >= 0 && t - last < minMs) return
      last = t
      const sec = t / 1000
      if (resync) {
        resync = false
        clock.elapsedTime = sec
      }
      advance(sec)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      setFrameloop('always')
    }
  }, [setFrameloop, advance, clock])
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
      gl={{ antialias: preset().antialias, powerPreference: 'high-performance' }}
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
      <Lightning />
      <Tears />
      <Projectiles />
      <XrayLayer />
      <HighlightLayer />
      <BroAfterimage />
      <Shoe />
      <Debris />
      <Explosions />
      <LockonSystem />
      <CameraRig />
      <GameFlow />
      <FrameLimiter />
      <AutoQuality />
      <Precompile />
    </Canvas>
  )
}
