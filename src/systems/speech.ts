import { SPEECH } from '../config/game'
import { on } from './events'
import { useGame } from './store'

/** イベントに兄のセリフ（吹き出し）を紐付ける。App で一度呼ぶ。旋回のセリフは Bro 側で出す */
export function bindSpeech(): () => void {
  const say = (text: string) => useGame.getState().say(text)
  const offs = [
    on('bro.say', ({ text }) => say(text)),
    on('imouto.skill', ({ id }) => say(SPEECH.lines[id])),
    on('bro.throw', ({ from }) => {
      if (from === 'shoulder') say(SPEECH.lines.throw)
    }),
    on('bro.goto', () => say(SPEECH.lines.goto)),
  ]
  return () => offs.forEach((f) => f())
}
