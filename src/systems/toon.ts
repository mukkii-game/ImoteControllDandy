import * as THREE from 'three'

let gradient: THREE.DataTexture | null = null
/** レトロ漫画風の3階調グラデーション */
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient
  const colors = new Uint8Array([70, 70, 160, 160, 255, 255])
  gradient = new THREE.DataTexture(colors, colors.length, 1, THREE.RedFormat)
  gradient.minFilter = THREE.NearestFilter
  gradient.magFilter = THREE.NearestFilter
  gradient.needsUpdate = true
  return gradient
}

export function toonMaterial(color: THREE.ColorRepresentation): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() })
}
