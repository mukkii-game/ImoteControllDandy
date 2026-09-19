import voices from '../config/voices.json'
import { on } from './events'
import { useGame } from './store'

/**
 * 音：voices.json のファイルがあれば再生、無ければ WebAudio で合成 SE。
 * ブラウザの制限で、最初のクリック（タイトルのスタート）以降に鳴る。
 */
let ctx: AudioContext | null = null
const available = new Map<string, boolean>()
const buffers = new Map<string, AudioBuffer>()
let bgm: AudioBufferSourceNode | null = null
let bgmGain: GainNode | null = null

function ac(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return null
    }
  }
  return ctx
}

async function load(url: string): Promise<AudioBuffer | null> {
  const c = ac()
  if (!c) return null
  if (buffers.has(url)) return buffers.get(url)!
  if (available.get(url) === false) return null
  try {
    const r = await fetch(url)
    if (!r.ok || (r.headers.get('content-type') ?? '').includes('text/html')) {
      available.set(url, false)
      return null
    }
    const buf = await c.decodeAudioData(await r.arrayBuffer())
    buffers.set(url, buf)
    available.set(url, true)
    return buf
  } catch {
    available.set(url, false)
    return null
  }
}

/** イベント名に対応する音声を鳴らす。無ければ false */
export async function playVoice(name: string, volume = 1): Promise<boolean> {
  const url = (voices as Record<string, string>)[name]
  if (!url) return false
  const c = ac()
  const buf = await load(url)
  if (!c || !buf) return false
  const src = c.createBufferSource()
  src.buffer = buf
  const g = c.createGain()
  g.gain.value = volume
  src.connect(g).connect(c.destination)
  src.start()
  return true
}

export async function playBgm(name: string, volume = 0.5) {
  const url = (voices as Record<string, string>)[name]
  const c = ac()
  if (!c) return
  stopBgm()
  if (!url) return
  const buf = await load(url)
  if (!buf) return
  bgm = c.createBufferSource()
  bgm.buffer = buf
  bgm.loop = true
  bgmGain = c.createGain()
  bgmGain.gain.value = volume
  bgm.connect(bgmGain).connect(c.destination)
  bgm.start()
}

export function stopBgm() {
  try {
    bgm?.stop()
  } catch {
    /* ignore */
  }
  bgm = null
}

/* ---------- 合成 SE（アセット無しでも鳴る） ---------- */

function noise(c: AudioContext, sec: number): AudioBuffer {
  const b = c.createBuffer(1, Math.floor(c.sampleRate * sec), c.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return b
}

/** ズシーン：サブベース＋短いノイズ */
export function seStomp(strength = 1) {
  const c = ac()
  if (!c || c.state !== 'running') return
  const t = c.currentTime
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(70, t)
  o.frequency.exponentialRampToValueAtTime(28, t + 0.35)
  const g = c.createGain()
  g.gain.setValueAtTime(0.9 * strength, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + 0.65)
  const n = c.createBufferSource()
  n.buffer = noise(c, 0.25)
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 400
  const ng = c.createGain()
  ng.gain.setValueAtTime(0.35 * strength, t)
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
  n.connect(f).connect(ng).connect(c.destination)
  n.start(t)
}

/** 爆発：ノイズのバースト */
export function seBoom() {
  const c = ac()
  if (!c || c.state !== 'running') return
  const t = c.currentTime
  const n = c.createBufferSource()
  n.buffer = noise(c, 0.7)
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.setValueAtTime(2500, t)
  f.frequency.exponentialRampToValueAtTime(120, t + 0.6)
  const g = c.createGain()
  g.gain.setValueAtTime(0.6, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.7)
  n.connect(f).connect(g).connect(c.destination)
  n.start(t)
}

/** ヒュン：投擲・ジャンプ */
export function seWhoosh(pitch = 1) {
  const c = ac()
  if (!c || c.state !== 'running') return
  const t = c.currentTime
  const n = c.createBufferSource()
  n.buffer = noise(c, 0.4)
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = 2
  f.frequency.setValueAtTime(600 * pitch, t)
  f.frequency.exponentialRampToValueAtTime(2400 * pitch, t + 0.3)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.4, t + 0.08)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
  n.connect(f).connect(g).connect(c.destination)
  n.start(t)
}

/** ピッ：ロックオン */
export function seLock(index = 0) {
  const c = ac()
  if (!c || c.state !== 'running') return
  const t = c.currentTime
  const o = c.createOscillator()
  o.type = 'square'
  o.frequency.value = 880 + index * 90
  const g = c.createGain()
  g.gain.setValueAtTime(0.12, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + 0.1)
}

/** チャイム：キーンコーンカーンコーン */
export function seChime() {
  const c = ac()
  if (!c || c.state !== 'running') return
  const notes = [659.25, 523.25, 587.33, 392.0, 392.0, 587.33, 659.25, 523.25]
  notes.forEach((f, i) => {
    const t = c.currentTime + i * 0.55
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    const g = c.createGain()
    g.gain.setValueAtTime(0.25, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2)
    o.connect(g).connect(c.destination)
    o.start(t)
    o.stop(t + 1.25)
  })
}

/** イベントに音を紐付ける。App で一度呼ぶ */
export function bindAudio(): () => void {
  const offs = [
    on('imouto.step', ({ strength }) => {
      playVoice('se.step', Math.min(1, 0.5 + strength)).then((ok) => {
        if (!ok) seStomp(Math.min(1, strength))
      })
    }),
    on('enemy.hit', () => {
      playVoice('se.boom').then((ok) => {
        if (!ok) seBoom()
      })
    }),
    on('bro.throw', () => {
      seWhoosh(1)
      playVoice('bro.throw')
    }),
    on('bro.mount', () => {
      seWhoosh(1.4)
      playVoice('bro.mount')
    }),
    on('bro.jump', () => seWhoosh(1.6)),
    on('imouto.hit', () => playVoice('imouto.hit')),
    on('imouto.skill', ({ id }) => playVoice(`imouto.skill.${id}`)),
    on('game.clear', () => {
      seChime()
      playVoice('game.clear')
      playBgm('bgm.ed')
    }),
    on('game.late', () => {
      playVoice('game.late')
      stopBgm()
    }),
  ]
  // フェーズ遷移で BGM
  const unsub = useGame.subscribe((s, prev) => {
    if (s.phase !== prev.phase) {
      if (s.phase === 'play') {
        ac()?.resume()
        playVoice('game.start')
        playBgm('bgm.play')
      }
    }
  })
  return () => {
    offs.forEach((f) => f())
    unsub()
  }
}
