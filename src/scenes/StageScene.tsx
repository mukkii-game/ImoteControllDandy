import { Canvas } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import { CAMERA, SCALE } from '../config/game'
import { Imouto } from '../entities/Imouto'
import { Bro } from '../entities/Bro'
import { CameraRig } from '../systems/camera'
import { Stage } from './Stage'

export function StageScene() {
  const H = SCALE.imoutoHeight
  return (
    <Canvas
      shadows
      camera={{ fov: CAMERA.ground.fov, near: CAMERA.near, far: CAMERA.far, position: [0, 2, 50] }}
      dpr={[1, 1.5]}
      gl={{ antialias: true }}
    >
      <Sky sunPosition={[100, 60, -100]} turbidity={6} />
      <fog attach="fog" args={['#cfe0f0', 200, CAMERA.far]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#cfe6ff', '#4a5a3a', 0.5]} />
      {/* 影：妹全体が入るシャドウカメラ */}
      <directionalLight
        position={[80, 120, -60]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-H * 1.5}
        shadow-camera-right={H * 1.5}
        shadow-camera-top={H * 1.5}
        shadow-camera-bottom={-H * 1.5}
        shadow-camera-near={1}
        shadow-camera-far={400}
        shadow-normalBias={0.3}
      />
      <Stage />
      <Imouto />
      <Bro />
      <CameraRig />
    </Canvas>
  )
}
