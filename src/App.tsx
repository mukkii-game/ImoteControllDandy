import { useEffect, useRef } from 'react'
import { StageScene } from './scenes/StageScene'
import { HUD } from './ui/HUD'
import { bindKeyboard } from './systems/input'
import { bindMouse } from './systems/mouse'
import { bindAudio } from './systems/audio'
import { bindSpeech } from './systems/speech'
import { bindOrientation } from './systems/orientation'
import { ModelViewer } from './dev/ModelViewer'

export default function App() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => bindKeyboard(), [])
  useEffect(() => bindAudio(), [])
  useEffect(() => bindSpeech(), [])
  useEffect(() => bindOrientation(), [])
  useEffect(() => (root.current ? bindMouse(root.current) : undefined), [])
  if (location.search.includes('viewer')) return <ModelViewer />
  return (
    <div className="app" ref={root}>
      <StageScene />
      <HUD />
    </div>
  )
}
