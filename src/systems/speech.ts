import { SPEECH } from '../config/game'
import { on } from './events'
import { useGame } from './store'
import { playVoice } from './audio'

/**
 * イベントにセリフ（吹き出し＋音声）を紐付ける。App で一度呼ぶ。
 * 兄：旋回は Bro 側で bro.say。技は Imouto 側（吹き出し→1 秒後に発動）。投擲は溜め開始時。
 * 妹：投げる時「そおれっ」、技の発動時。タイトルではあくび。
 */
export function bindSpeech(): () => void {
  const say = (text: string, key?: string) => {
    useGame.getState().say(text)
    if (key) void playVoice(`line.bro.${key}`)
  }
  const sayImouto = (text: string, key?: string) => {
    useGame.getState().sayImouto(text)
    if (key) void playVoice(`line.imouto.${key}`)
  }
  const offs = [
    on('bro.say', ({ text, key }) => say(text, key)),
    on('imouto.say', ({ text, key }) => sayImouto(text, key)),
    on('bro.charge', () => say(SPEECH.lines.throw, 'throw')),
    on('bro.throw', ({ from }) => {
      if (from === 'shoulder') sayImouto(SPEECH.imouto.throw, 'throw')
    }),
    on('imouto.skill', ({ id }) => {
      if (id === 'skip') sayImouto(SPEECH.imouto.skip, 'skip')
      if (id === 'shoe') sayImouto(SPEECH.imouto.shoe, 'shoe')
    }),
    on('bro.goto', () => say(SPEECH.lines.goto, 'goto')),
  ]
  return () => offs.forEach((f) => f())
}
