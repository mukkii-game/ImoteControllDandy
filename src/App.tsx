import { useEffect } from 'react'
import { StageScene } from './scenes/StageScene'
import { HUD } from './ui/HUD'
import { bindKeyboard } from './systems/input'
import { ModelViewer } from './dev/ModelViewer'

export default function App() {
  useEffect(() => bindKeyboard(), [])
  if (location.search.includes('viewer')) return <ModelViewer />
  return (
    <div className="app">
      <StageScene />
      <HUD />
    </div>
  )
}
