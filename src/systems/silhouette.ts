import * as THREE from 'three'

/**
 * モデル全体を「同じ色の半透明シルエット」で描く仕組み（口や歯がレントゲンみたいに透けない）。
 * 仕組み：各メッシュの複製を 2 つ作る。1 つ目は深度だけ書く（色は書かない）、2 つ目は同じ深度の面だけ色を塗る。
 * これで一番手前の面だけが 1 回塗られ、重なりが濃くならない。
 * set(alpha)：alpha<=0 で元のモデルを表示、>0 で元を隠してシルエットを alpha の濃さで表示。hide() で全部消す。
 */
export interface Silhouette {
  set: (alpha: number) => void
  hide: () => void
  /**
   * 消え具合 k（0=元のモデル … 1=完全に消えた）で段階的に描く。
   * 前半（k<0.5）はモデルの上にシルエット色を重ねて染めていき（peak の濃さまで）、後半はシルエットだけを peak から 0 へ薄めて消す
   */
  blend: (k: number, peak: number) => void
  dispose: () => void
}

export function makeSilhouette(root: THREE.Object3D, color: string): Silhouette {
  const originals: THREE.Mesh[] = []
  const depthMeshes: THREE.Mesh[] = []
  const colorMeshes: THREE.Mesh[] = []
  const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true })
  const colorMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, depthFunc: THREE.LessEqualDepth })
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && m.visible) originals.push(m)
  })
  for (const m of originals) {
    const d = m.clone() as THREE.Mesh
    d.material = depthMat
    d.renderOrder = 10
    d.visible = false
    const c = m.clone() as THREE.Mesh
    c.material = colorMat
    c.renderOrder = 11
    c.visible = false
    m.parent?.add(d, c)
    depthMeshes.push(d)
    colorMeshes.push(c)
  }
  // overlay：元のモデルを表示したまま、その上（同じ深度の面だけ）にシルエット色を重ねる（染める）
  let mode: 'normal' | 'overlay' | 'sil' | 'hidden' = 'normal'
  const apply = (next: typeof mode) => {
    if (next === mode) return
    mode = next
    for (const m of originals) m.visible = next === 'normal' || next === 'overlay'
    for (const m of depthMeshes) m.visible = next === 'sil'
    for (const m of colorMeshes) m.visible = next === 'sil' || next === 'overlay'
  }
  return {
    set: (alpha) => {
      if (alpha <= 0) apply('normal')
      else {
        colorMat.opacity = Math.min(1, alpha)
        apply('sil')
      }
    },
    hide: () => apply('hidden'),
    blend: (k, peak) => {
      if (k <= 0) apply('normal')
      else if (k >= 1) apply('hidden')
      else if (k < 0.5) {
        colorMat.opacity = Math.min(1, peak * (k / 0.5))
        apply('overlay')
      } else {
        colorMat.opacity = Math.min(1, peak * (1 - (k - 0.5) / 0.5))
        apply('sil')
      }
    },
    dispose: () => {
      apply('normal')
      for (const m of [...depthMeshes, ...colorMeshes]) m.parent?.remove(m)
      depthMat.dispose()
      colorMat.dispose()
    },
  }
}
