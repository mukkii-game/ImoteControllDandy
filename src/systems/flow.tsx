import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { GAME } from '../config/game'
import { refs } from './refs'
import { useGame } from './store'
import { emit } from './events'

/**
 * ゲーム進行：タイマー、校門通過でクリア、時間切れで遅刻。
 * phase: title → play → clear | late
 */
export function GameFlow() {
  const elapsed = useRef(0)
  const hudClock = useRef(0)

  useEffect(() => {
    const st = useGame.getState()
    st.setTimeLeft(GAME.timeLimitSec)
  }, [])

  useFrame((_, dt) => {
    const st = useGame.getState()
    if (st.phase !== 'play') return
    elapsed.current += dt
    const left = Math.max(0, GAME.timeLimitSec - elapsed.current)
    hudClock.current += dt
    if (hudClock.current > 0.1) {
      hudClock.current = 0
      st.setTimeLeft(left)
    }
    const im = refs.imouto
    if (im && im.position.z >= GAME.gateZ && Math.abs(im.position.x) < GAME.gateHalfWidth + 40) {
      st.setClearTime(elapsed.current)
      st.setTimeLeft(left)
      st.setPhase('clear')
      emit('game.clear', undefined)
      return
    }
    if (left <= 0) {
      st.setTimeLeft(0)
      st.setPhase('late')
      emit('game.late', undefined)
    }
  })
  return null
}
