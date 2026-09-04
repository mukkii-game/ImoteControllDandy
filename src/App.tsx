import { useEffect } from 'react'
import { StageScene } from './scenes/StageScene'
import { HUD } from './ui/HUD'
import { bindKeyboard } from './systems/input'

export default function App() {
  useEffect(() => bindKeyboard(), [])
  return (
    <div className="app">
      <StageScene />
      <HUD />
    </div>
  )
}
