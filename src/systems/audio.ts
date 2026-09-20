import voices from '../config/voices.json'
import { SOUND } from '../config/game'
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

/** 全部の音がここを通る（全体音量 SOUND.masterVolume） */
let masterGain: GainNode | null = null
function dest(c: AudioContext): GainNode {
  if (!masterGain) {
    masterGain = c.createGain()
    masterGain.connect(c.destination)
  }
  masterGain.gain.value = SOUND.masterVolume
  return masterGain
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
  src.connect(g).connect(dest(c))
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
  bgm.connect(bgmGain).connect(dest(c))
  bgm.start()
}

/* ---------- ループ音（電撃など。鳴っている間だけ回す） ---------- */
let loopSrc: AudioBufferSourceNode | null = null
let loopToken = 0
export async function startLoop(name: string, volume = 1) {
  const url = (voices as Record<string, string>)[name]
  const c = ac()
  if (!c || !url) return
  const token = ++loopToken
  stopLoop()
  loopToken = token
  const buf = await load(url)
  // 読み込み待ちの間に stop されていたら鳴らさない
  if (!buf || loopToken !== token) return
  const src = c.createBufferSource()
  src.buffer = buf
  src.loop = true
  const g = c.createGain()
  g.gain.value = volume
  src.connect(g).connect(dest(c))
  src.start()
  loopSrc = src
}
export function stopLoop() {
  loopToken++
  try {
    loopSrc?.stop()
  } catch {
    /* ignore */
  }
  loopSrc = null
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

/** ズシーン：巨大ロボの足音。サブの衝撃＋金属的な軋み＋余韻の地響き */
export function seStomp(strength = 1) {
  const c = ac()
  if (!c || c.state !== 'running') return
  const t = c.currentTime
  const master = c.createGain()
  master.gain.value = 1.2 * strength
  master.connect(dest(c))
  // 1) 衝撃：ピッチが急落するサブ
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(110, t)
  o.frequency.exponentialRampToValueAtTime(22, t + 0.5)
  const g = c.createGain()
  g.gain.setValueAtTime(1.0, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.1)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + 1.2)
  // 2) 打撃の芯：短いローパスノイズ
  const n = c.createBufferSource()
  n.buffer = noise(c, 0.3)
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.setValueAtTime(900, t)
  f.frequency.exponentialRampToValueAtTime(120, t + 0.25)
  const ng = c.createGain()
  ng.gain.setValueAtTime(0.7, t)
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
  n.connect(f).connect(ng).connect(master)
  n.start(t)
  // 3) 金属の軋み：矩形波の短い唸り
  const m = c.createOscillator()
  m.type = 'sawtooth'
  m.frequency.setValueAtTime(180, t + 0.02)
  m.frequency.exponentialRampToValueAtTime(60, t + 0.35)
  const mf = c.createBiquadFilter()
  mf.type = 'bandpass'
  mf.Q.value = 6
  mf.frequency.value = 320
  const mg = c.createGain()
  mg.gain.setValueAtTime(0.18, t + 0.02)
  mg.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
  m.connect(mf).connect(mg).connect(master)
  m.start(t + 0.02)
  m.stop(t + 0.45)
  // 4) 地響きの余韻：長いローノイズ
  const r = c.createBufferSource()
  r.buffer = noise(c, 1.4)
  const rf = c.createBiquadFilter()
  rf.type = 'lowpass'
  rf.frequency.value = 90
  const rg = c.createGain()
  rg.gain.setValueAtTime(0.5, t + 0.05)
  rg.gain.exponentialRampToValueAtTime(0.001, t + 1.4)
  r.connect(rf).connect(rg).connect(master)
  r.start(t + 0.05)
}

/** 爆発・崩壊：低音の炸裂＋瓦礫のパラパラ */
export function seBoom() {
  const c = ac()
  if (!c || c.state !== 'running') return
  const t = c.currentTime
  const master = c.createGain()
  master.gain.value = 0.9
  master.connect(dest(c))
  // 炸裂
  const n = c.createBufferSource()
  n.buffer = noise(c, 0.9)
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.setValueAtTime(3200, t)
  f.frequency.exponentialRampToValueAtTime(90, t + 0.8)
  const g = c.createGain()
  g.gain.setValueAtTime(0.9, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.9)
  n.connect(f).connect(g).connect(master)
  n.start(t)
  // サブの衝撃
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(90, t)
  o.frequency.exponentialRampToValueAtTime(30, t + 0.4)
  const og = c.createGain()
  og.gain.setValueAtTime(0.8, t)
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
  o.connect(og).connect(master)
  o.start(t)
  o.stop(t + 0.65)
  // 瓦礫：短いクリックをランダムに
  for (let i = 0; i < 7; i++) {
    const tt = t + 0.15 + Math.random() * 0.6
    const d = c.createBufferSource()
    d.buffer = noise(c, 0.04)
    const df = c.createBiquadFilter()
    df.type = 'bandpass'
    df.frequency.value = 800 + Math.random() * 2500
    df.Q.value = 3
    const dg = c.createGain()
    dg.gain.setValueAtTime(0.25, tt)
    dg.gain.exponentialRampToValueAtTime(0.001, tt + 0.06)
    d.connect(df).connect(dg).connect(master)
    d.start(tt)
  }
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
  n.connect(f).connect(g).connect(dest(c))
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
  o.connect(g).connect(dest(c))
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
    o.connect(g).connect(dest(c))
    o.start(t)
    o.stop(t + 1.25)
  })
}

let lastBuildingAt = -1
let lastHitVoiceAt = -1
let hitCount = 0
let tackleIdx = 0
/** 建物が壊れた音。SOUND.building.minGapSec より短い間隔では鳴らさない（合成音のフォールバックあり） */
function playBuilding() {
  const now = performance.now() / 1000
  if (now - lastBuildingAt < SOUND.building.minGapSec) return
  lastBuildingAt = now
  const key = Math.random() < 0.5 ? 'se.building1' : 'se.building2'
  playVoice(key, SOUND.building.volume).then((ok) => {
    if (!ok) seBoom()
  })
}

/** イベントに音を紐付ける。App で一度呼ぶ */
export function bindAudio(): () => void {
  const offs = [
    on('imouto.step', ({ strength }) => {
      playVoice('se.step', Math.min(1, 0.5 + strength) * 0.5).then((ok) => {
        if (!ok) seStomp(Math.min(1, strength) * 0.5)
      })
    }),
    on('enemy.hit', ({ id }) => {
      // id -1 は建物（音は building.* 側で鳴らす）
      if (id === -1) return
      playVoice('se.boom').then((ok) => {
        if (!ok) seBoom()
      })
    }),
    // 建物が壊れた音（2 種類をランダム）。妹の一歩で何軒も潰れるので、短い間隔では鳴らさない
    on('building.crush', () => playBuilding()),
    on('building.break', () => playBuilding()),
    on('bro.throw', ({ from }) => {
      // 肩上からの発射は雷、地上からは風切り
      const key = from === 'shoulder' ? 'se.fire' : 'se.throw'
      playVoice(key, from === 'shoulder' ? SOUND.fireVolume : 1).then((ok) => {
        if (!ok) seWhoosh(1)
      })
      playVoice('bro.throw')
    }),
    on('bro.mount', () => {
      playVoice('se.jump').then((ok) => {
        if (!ok) seWhoosh(1.4)
      })
      playVoice('bro.mount')
    }),
    on('bro.dismount', () => {
      playVoice('se.land').then((ok) => {
        if (!ok) seWhoosh(0.8)
      })
      playVoice('bro.dismount')
    }),
    on('bomb.burst', () => {
      playVoice('se.boom', 0.6).then((ok) => {
        if (!ok) seBoom()
      })
    }),
    // 電撃：出ている間だけ雷魔法3 をループ
    on('lightning.start', () => startLoop('se.lightning', SOUND.lightningVolume)),
    on('lightning.stop', () => stopLoop()),
    on('bro.tackle', () => {
      // タックル：2 種類の音を順繰りに
      tackleIdx = (tackleIdx % SOUND.tackleSounds) + 1
      playVoice(`se.tackle.${tackleIdx}`).then((ok) => {
        if (!ok) seWhoosh(1.2)
      })
    }),
    on('bro.land', () => {
      playVoice('se.jumpLand').then((ok) => {
        if (!ok) seWhoosh(0.8)
      })
    }),
    on('bro.jump', () => {
      playVoice('se.jump').then((ok) => {
        if (!ok) seWhoosh(1.6)
      })
    }),
    on('imouto.hit', () => {
      // 「痛っ」：hitVoiceEvery 回に 1 回、鳴ったら hitVoiceMinGapSec の間は鳴らさない。声は hitVoices 種からランダム
      hitCount++
      if (hitCount % SOUND.hitVoiceEvery !== 0) return
      const now = performance.now() / 1000
      if (now - lastHitVoiceAt < SOUND.hitVoiceMinGapSec) return
      lastHitVoiceAt = now
      playVoice(`imouto.hit.${1 + Math.floor(Math.random() * SOUND.hitVoices)}`)
    }),
    on('imouto.skill', ({ id }) => playVoice(`imouto.skill.${id}`)),
    on('game.clear', () => {
      playVoice('se.chime').then((ok) => {
        if (!ok) seChime()
      })
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
    // ポーズ（Esc）中は音を全部止める（BGM・ループ音・鳴っている途中の SE も）。解除で続きから
    if (s.tuneOpen !== prev.tuneOpen) {
      const c = ac()
      if (c) void (s.tuneOpen ? c.suspend() : c.resume())
    }
    if (s.phase !== prev.phase) {
      if (s.phase === 'play') {
        ac()?.resume()
        playVoice('game.start')
        playBgm('bgm.play', SOUND.bgmVolume)
      }
    }
  })
  return () => {
    offs.forEach((f) => f())
    unsub()
  }
}
