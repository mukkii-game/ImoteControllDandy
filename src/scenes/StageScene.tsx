import { Canvas } from '@react-three/fiber'
import { CAMERA, SCALE } from '../config/game'
import { Imouto } from '../entities/Imouto'
import { Bro } from '../entities/Bro'
import { CameraRig } from '../systems/camera'
import { Stage } from './Stage'
import { ShadowFollower } from '../systems/shadow'
import { Explosions, BroTrail } from '../entities/Enemies'
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
      dpr={LITE ? 1 : [1, 1.5]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#f3e6c8']} />
      <fog attach="fog" args={['#f3e6c8', 300, CAMERA.far]} />
      <ambientLight intensity={0.7} />
      <hemisphereLight args={['#fff2d0', '#6a7a4a', 0.5]} />
      <ShadowFollower size={H * 1.6} />
      <Stage />
      <Imouto />
      <Bro />
      <Fighters />
      <GroundEnemies />
      <Shoe />
      <Debris />
      <Explosions />
      <BroTrail />
      <LockonSystem />
      <CameraRig />
      <GameFlow />
    </Canvas>
  )
}
