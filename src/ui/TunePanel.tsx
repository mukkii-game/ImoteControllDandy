import { useEffect, useState } from 'react'
import { TUNE_GROUPS, getTune, setTune, resetTune, diffTune, saveTune, loadTune } from '../config/tuning'
import { useGame } from '../systems/store'
import { useModels } from '../systems/models'
import { MODEL_CHOICES } from '../config/game'

/** Esc で開閉。スライダーで config の数値をその場で書き換える。変更分は JSON でコピーできる */
export function TunePanel() {
  const open = useGame((s) => s.tuneOpen)
  const setOpen = useGame((s) => s.setTuneOpen)
  const bump = useGame((s) => s.bumpTune)
  const [, force] = useState(0)
  const [copied, setCopied] = useState(false)
  const models = useModels()

  useEffect(() => {
    loadTune()
    bump()
  }, [bump])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'Tab') {
        e.preventDefault()
        setOpen(!useGame.getState().tuneOpen)
        if (document.pointerLockElement) document.exitPointerLock()
      }
    }
    // ポインターロック中の Esc はページに届かないので、ロック解除をパネル開扉とみなす
    const onLock = () => {
      if (!document.pointerLockElement && !useGame.getState().tuneOpen) setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerlockchange', onLock)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerlockchange', onLock)
    }
  }, [setOpen])

  if (!open) return null

  const onChange = (path: string, v: number) => {
    setTune(path, v)
    saveTune()
    bump()
    force((n) => n + 1)
  }
  const copy = async () => {
    const text = JSON.stringify(diffTune(), null, 2)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('コピーしてください', text)
    }
  }

  return (
    <div className="tune" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <div className="tune-head">
        <b>調整パネル</b>
        <span className="tune-note">ポーズ中。Esc / Tab で再開。値は自動保存</span>
        <button onClick={copy}>{copied ? 'コピーした' : '変更をコピー'}</button>
        <button
          onClick={() => {
            resetTune()
            bump()
            force((n) => n + 1)
          }}
        >
          リセット
        </button>
      </div>
      <div className="tune-body">
        <div className="tune-group">
          <div className="tune-title">モデル</div>
          {(['imouto', 'bro'] as const).map((who) => (
            <label key={who} className="tune-row tune-row-select">
              <span>{who === 'imouto' ? '妹' : '兄'}</span>
              <select value={models[who]} onChange={(e) => models.select(who, e.target.value)}>
                {MODEL_CHOICES[who].map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <div className="tune-note">ファイルが無い候補は次の候補に自動で切り替わります</div>
        </div>
        {TUNE_GROUPS.map((g) => (
          <div key={g.title} className="tune-group">
            <div className="tune-title">{g.title}</div>
            {g.items.map((it) => {
              const v = getTune(it.path)
              return (
                <label key={it.path} className="tune-row">
                  <span>{it.label}</span>
                  <input type="range" min={it.min} max={it.max} step={it.step} value={v} onChange={(e) => onChange(it.path, Number(e.target.value))} />
                  <input type="number" step={it.step} value={Number(v.toFixed(4))} onChange={(e) => onChange(it.path, Number(e.target.value))} />
                </label>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
