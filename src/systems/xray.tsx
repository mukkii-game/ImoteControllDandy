import { useEffect, useRef, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CAMERA } from '../config/game'
import { useGame } from './store'
import { refs } from './refs'

/**
 * X 線輪郭：何か（妹の体・建物）の向こう側に隠れている敵の「輪郭だけ」を光らせて見せる。
 * 仕組み：敵のメッシュの複製を、深度テストを逆（GreaterDepth＝手前に何か描かれている所だけ）にして描く。
 * 色はリムライト（面が視線に対して横を向くほど明るい）なので、隠れた部分の縁だけが光って輪郭に見える。
 * 射撃モード（溜め中・攻撃中）のときだけ表示。CAMERA.aim.xray で色・強さ。
 */
export const xrayRoots = new Set<THREE.Object3D>()

const XRAY_TAG = '__xray'

function makeRimMaterial(): THREE.ShaderMaterial {
  const x = CAMERA.aim.xray
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    depthFunc: THREE.GreaterDepth,
    blending: THREE.AdditiveBlending,
    // 表面だけ（両面だと自分の裏面が「自分の表面より奥」なので隠れていなくても縁が出てしまう）。
    // 自分の表面と同じ深度で誤って描かれないよう、わずかに手前へずらす
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
    uniforms: {
      uColor: { value: new THREE.Color(x.color) },
      uPower: { value: x.power },
      uIntensity: { value: x.intensity },
      uOpacity: { value: 1 },
    },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec3 p = position;
        vec3 n = normal;
        #ifdef USE_INSTANCING
          p = (instanceMatrix * vec4(position, 1.0)).xyz;
          n = mat3(instanceMatrix) * n;
        #endif
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * n);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uIntensity;
      uniform float uOpacity;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
        gl_FragColor = vec4(uColor * uIntensity, rim * uOpacity);
      }
    `,
  })
}

/** 登録した root の下のメッシュに X 線輪郭の複製を付けて、射撃モード中だけ表示する。StageScene に 1 つ置く */
export function XrayLayer() {
  const { camera } = useThree()
  const mat = useRef<THREE.ShaderMaterial | null>(null)
  const clones = useRef<{ src: THREE.Mesh | THREE.InstancedMesh; dst: THREE.Mesh | THREE.InstancedMesh }[]>([])
  const scanT = useRef(0)

  useEffect(() => {
    mat.current = makeRimMaterial()
    return () => {
      for (const c of clones.current) c.dst.parent?.remove(c.dst)
      clones.current = []
      mat.current?.dispose()
    }
  }, [])

  useFrame((_, dt) => {
    const m = mat.current
    if (!m) return
    const x = CAMERA.aim.xray
    const st = useGame.getState()
    const active = x.enabled && st.phase === 'play' && (st.charging || st.mode === 'thrown' || x.alwaysOn)
    // 新しいメッシュ（外部モデルが後から読めた等）を拾う。毎フレームは重いので間隔を空ける
    scanT.current -= dt
    if (scanT.current <= 0) {
      scanT.current = x.scanEverySec
      for (const root of xrayRoots) {
        root.traverse((o) => {
          const mesh = o as THREE.Mesh
          if (!mesh.isMesh || mesh.userData[XRAY_TAG]) return
          mesh.userData[XRAY_TAG] = true
          // スモークの帯や光の軌跡（ShaderMaterial）、userData.noXray のものは対象外
          const mt = mesh.material as THREE.Material
          if (!mt || mt.type === 'ShaderMaterial' || mesh.userData.noXray) return
          let dst: THREE.Mesh | THREE.InstancedMesh
          const im = mesh as THREE.InstancedMesh
          if (im.isInstancedMesh) {
            const d = new THREE.InstancedMesh(im.geometry, m, im.instanceMatrix.count)
            d.instanceMatrix = im.instanceMatrix // 行列を共有（毎フレーム同期不要）
            d.count = im.count
            dst = d
          } else {
            dst = new THREE.Mesh(mesh.geometry, m)
          }
          dst.userData[XRAY_TAG] = true
          dst.position.copy(mesh.position)
          dst.quaternion.copy(mesh.quaternion)
          dst.scale.copy(mesh.scale)
          dst.renderOrder = 20
          dst.frustumCulled = false
          dst.castShadow = false
          dst.receiveShadow = false
          dst.visible = false
          mesh.parent?.add(dst)
          clones.current.push({ src: mesh, dst })
        })
      }
    }
    // 表示の同期（元が消えていれば消す。InstancedMesh は count を合わせる）。
    // 見せるのは「カメラから見て妹の体に重なって隠れている敵」だけ（建物に隠れた敵は対象外）
    const im = refs.imouto
    for (let i = clones.current.length - 1; i >= 0; i--) {
      const { src, dst } = clones.current[i]
      if (!src.parent) {
        dst.parent?.remove(dst)
        clones.current.splice(i, 1)
        continue
      }
      // 親のどこかが非表示なら見せない
      let vis = active && src.visible
      let p: THREE.Object3D | null = src.parent
      while (vis && p) {
        if (!p.visible) vis = false
        p = p.parent
      }
      if (vis && im) {
        const inst = src as THREE.InstancedMesh
        if (inst.isInstancedMesh) {
          // どれか 1 つでも妹の向こうにあれば見せる（個別には分けられない）
          let any = false
          const arr = inst.instanceMatrix.array
          for (let k = 0; k < inst.count && !any; k++) {
            wp.set(arr[k * 16 + 12], arr[k * 16 + 13], arr[k * 16 + 14])
            inst.localToWorld(wp)
            any = behindImouto(camera.position, im.position, wp, x.occluderRadius, x.occluderHeight)
          }
          vis = any
        } else {
          src.getWorldPosition(wp)
          vis = behindImouto(camera.position, im.position, wp, x.occluderRadius, x.occluderHeight)
        }
      }
      dst.visible = vis
      if ((src as THREE.InstancedMesh).isInstancedMesh) (dst as THREE.InstancedMesh).count = (src as THREE.InstancedMesh).count
    }
  })
  return null
}

const wp = new THREE.Vector3()

/**
 * カメラ→点の線分が、妹の体（足元 imPos を中心とする半径 r・高さ h の円柱）を通るか。
 * 通っていれば、その点はカメラから見て妹に隠れている
 */
function behindImouto(cam: THREE.Vector3, imPos: THREE.Vector3, p: THREE.Vector3, r: number, h: number): boolean {
  const dx = p.x - cam.x
  const dz = p.z - cam.z
  const l2 = dx * dx + dz * dz
  if (l2 < 1e-6) return false
  // 線分上で妹の軸に一番近い点（XZ 平面）
  let t = ((imPos.x - cam.x) * dx + (imPos.z - cam.z) * dz) / l2
  if (t <= 0 || t >= 1) return false // 妹がカメラの後ろ、または敵より遠い
  t = THREE.MathUtils.clamp(t, 0, 1)
  const cx = cam.x + dx * t - imPos.x
  const cz = cam.z + dz * t - imPos.z
  if (cx * cx + cz * cz > r * r) return false
  const y = cam.y + (p.y - cam.y) * t
  return y >= imPos.y && y <= imPos.y + h
}

/** X 線輪郭を付けたい敵のまとまりを包む（中のメッシュが対象になる） */
export function XrayRoot({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null!)
  useEffect(() => {
    const g = ref.current
    xrayRoots.add(g)
    return () => {
      xrayRoots.delete(g)
    }
  }, [])
  return <group ref={ref}>{children}</group>
}
