import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { RETRO } from '../config/game'
import { on } from './events'

/**
 * 昭和アニメ風の仕上げ（後処理）。シーンを一度テクスチャ（色＋奥行き）に描いてから、画面全体に 1 枚のシェーダーをかける：
 * 墨の輪郭線・網点・色の段付け・フィルムの粒・周辺減光・インパクトフレーム。数値は config の RETRO。
 * useFrame の優先度 1 で R3F の自動描画を止め、ここで描く（このコンポーネントを外せば元の描画に戻る）
 */

let impactLeft = 0
let impactCool = 0
/** 外から呼べるインパクトフレーム（技など） */
export function triggerImpact() {
  if (impactCool > 0) return
  impactLeft = RETRO.impact.sec
  impactCool = RETRO.impact.cooldownSec
}

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const frag = /* glsl */ `
#include <common>
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 resolution;
uniform float cameraNear, cameraFar, time, amount, impact;
uniform float inkStrength, inkWidth, inkThreshold, inkFadeNear, inkFadeFar;
uniform vec3 inkColor;
uniform float toneStrength, toneDot, toneFrom, toneTo, toneAngle;
uniform float posterSteps, posterAmount, grain, vignette;
uniform vec3 skyColor; // 画面の色（sRGB）。背景はトーンマッピングしないので別に足す
varying vec2 vUv;

float linDepth(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  return -perspectiveDepthToViewZ(d, cameraNear, cameraFar);
}
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

void main() {
  // 線形の色 → 画面の色。背景（アルファ 0）は描かずに抜いてあるので、空の色を後ろに合成する
  vec4 src = texture2D(tColor, vUv);
  float a = clamp(src.a, 0.0, 1.0);
  vec3 lin = src.rgb / max(a, 0.0001);
  #ifdef TONE_MAPPING
  lin = toneMapping(lin);
  #endif
  vec3 col = linearToOutputTexel(vec4(lin, 1.0)).rgb * a + skyColor * (1.0 - a);
  if (amount <= 0.0) { gl_FragColor = vec4(col, 1.0); return; }

  // 墨の輪郭線：周り 4 点との奥行きの段差（距離に対する割合）が大きい所を線にする
  vec2 px = inkWidth / resolution;
  float dc = linDepth(vUv);
  float dl = linDepth(vUv - vec2(px.x, 0.0));
  float dr = linDepth(vUv + vec2(px.x, 0.0));
  float du = linDepth(vUv + vec2(0.0, px.y));
  float dd = linDepth(vUv - vec2(0.0, px.y));
  float dmin = min(min(dl, dr), min(du, dd));
  // 手前側（自分より近い隣がある所）だけ線にすると、線が物の外側に 1 本だけ出る
  float edge = (dc - dmin) / max(dmin, 0.001);
  float ink = smoothstep(inkThreshold, inkThreshold * 2.5, edge);
  ink *= 1.0 - smoothstep(inkFadeNear, inkFadeFar, dmin);

  // 色の段付け（セル塗りっぽく）
  vec3 post = floor(col * posterSteps + 0.5) / posterSteps;
  col = mix(col, post, posterAmount * amount);

  // 網点：暗い所ほど点が大きい。網は toneAngle だけ回す
  float l = dot(col, vec3(0.299, 0.587, 0.114)); // 画面の明るさ（sRGB）
  float m = smoothstep(toneFrom, toneTo, l);
  vec2 fc = gl_FragCoord.xy;
  float ca = cos(toneAngle), sa = sin(toneAngle);
  vec2 r = vec2(ca * fc.x - sa * fc.y, sa * fc.x + ca * fc.y) / toneDot;
  vec2 cell = fract(r) - 0.5;
  float dotR = sqrt(m) * 0.55;
  float dotMask = 1.0 - smoothstep(dotR - 0.08, dotR + 0.08, length(cell));
  col *= 1.0 - dotMask * toneStrength * amount;

  // 墨
  col = mix(col, inkColor, ink * inkStrength * amount);

  // フィルムの粒と周辺減光
  float n = hash12(fc + fract(time) * 1000.0) - 0.5;
  col += n * grain * amount;
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * vignette * 2.0 * amount;

  // インパクトフレーム：白黒反転の 2 値
  if (impact > 0.0) {
    float bw = 1.0 - step(0.42, dot(col, vec3(0.299, 0.587, 0.114)));
    col = mix(col, vec3(bw), clamp(impact, 0.0, 1.0));
  }
  // 色の変換は最初に自分でやったので、ここでは何もしない（tonemapping / colorspace の include は入れない）
  gl_FragColor = vec4(col, 1.0);
}
`

export function RetroPost({ samples }: { samples: number }) {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const viewport = useThree((s) => s.viewport)

  const target = useMemo(() => {
    // 色は HalfFloat の線形のまま描き、仕上げのシェーダーで画面の色（トーンマッピング＋sRGB）にする
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples })
    rt.depthTexture = new THREE.DepthTexture(1, 1)
    rt.depthTexture.type = THREE.FloatType
    return rt
  }, [samples])

  const { quadScene, quadCam, mat } = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: null },
        tDepth: { value: null },
        resolution: { value: new THREE.Vector2(1, 1) },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 1000 },
        time: { value: 0 },
        amount: { value: 1 },
        impact: { value: 0 },
        inkStrength: { value: 1 },
        inkWidth: { value: 1 },
        inkThreshold: { value: 0.03 },
        inkFadeNear: { value: 200 },
        inkFadeFar: { value: 600 },
        inkColor: { value: new THREE.Color() },
        toneStrength: { value: 0.3 },
        toneDot: { value: 5 },
        toneFrom: { value: 0.5 },
        toneTo: { value: 0.1 },
        toneAngle: { value: 0.785 },
        posterSteps: { value: 5 },
        posterAmount: { value: 0.3 },
        grain: { value: 0.03 },
        vignette: { value: 0.3 },
        skyColor: { value: new THREE.Vector3() },
      },
    })
    const quadScene = new THREE.Scene()
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
    quad.frustumCulled = false
    quadScene.add(quad)
    return { quadScene, quadCam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mat }
  }, [])

  useEffect(() => {
    const w = Math.max(1, Math.round(size.width * viewport.dpr))
    const h = Math.max(1, Math.round(size.height * viewport.dpr))
    target.setSize(w, h)
    mat.uniforms.resolution.value.set(w, h)
  }, [size, viewport.dpr, target, mat])

  useEffect(() => () => target.dispose(), [target])

  // 敵に当てた・技を出した瞬間のインパクトフレーム
  useEffect(() => {
    const a = on('enemy.hit', ({ dir }) => {
      if (RETRO.impact.onHit && dir) triggerImpact()
    })
    const b = on('imouto.skill', () => {
      if (RETRO.impact.onSkill) triggerImpact()
    })
    return () => {
      a()
      b()
    }
  }, [])

  useFrame((state, dt) => {
    const { scene, camera } = state
    impactCool = Math.max(0, impactCool - dt)
    impactLeft = Math.max(0, impactLeft - dt)
    const u = mat.uniforms
    const cam = camera as THREE.PerspectiveCamera
    u.tColor.value = target.texture
    u.tDepth.value = target.depthTexture
    u.cameraNear.value = cam.near
    u.cameraFar.value = cam.far
    u.time.value = state.clock.elapsedTime
    u.amount.value = RETRO.amount
    u.impact.value = impactLeft > 0 ? 1 : 0
    u.inkStrength.value = RETRO.ink.strength
    u.inkWidth.value = RETRO.ink.width * viewport.dpr
    u.inkThreshold.value = RETRO.ink.threshold
    u.inkFadeNear.value = RETRO.ink.fadeNear
    u.inkFadeFar.value = RETRO.ink.fadeFar
    ;(u.inkColor.value as THREE.Color).set(RETRO.ink.color)
    u.toneStrength.value = RETRO.tone.strength
    u.toneDot.value = RETRO.tone.dot * viewport.dpr
    u.toneFrom.value = RETRO.tone.from
    u.toneTo.value = RETRO.tone.to
    u.toneAngle.value = RETRO.tone.angle
    u.posterSteps.value = RETRO.posterize.steps
    u.posterAmount.value = RETRO.posterize.amount
    u.grain.value = RETRO.grain
    u.vignette.value = RETRO.vignette
    // 背景（空の色）を外して透明で描く → シェーダーで画面の色の空を合成（画面直描きの時と同じ空の色になる）
    const bg = scene.background
    if (bg instanceof THREE.Color) {
      const c = { r: 0, g: 0, b: 0 }
      bg.getRGB(c, THREE.SRGBColorSpace)
      ;(u.skyColor.value as THREE.Vector3).set(c.r, c.g, c.b)
    }
    scene.background = null
    const prevAlpha = gl.getClearAlpha()
    gl.setClearAlpha(0)
    gl.setRenderTarget(target)
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(null)
    gl.setClearAlpha(prevAlpha)
    scene.background = bg
    gl.render(quadScene, quadCam)
  }, 1)
  return null
}
