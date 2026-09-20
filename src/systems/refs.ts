import * as THREE from 'three'
import { LOCKON } from '../config/game'

/** エンティティ間で共有する参照（カメラ・乗降で使う）。React state にしないのは毎フレーム更新のため */
export const refs = {
  bro: null as THREE.Group | null,
  imouto: null as THREE.Group | null,
  /** 妹の肩アンカー（ボーンの子）。getWorldPosition で使う */
  shoulder: null as THREE.Object3D | null,
  /** 妹の頭ボーン。肩上カメラのオービット中心 */
  head: null as THREE.Object3D | null,
  /** 妹の右手の骨（生ボーン）と中指の付け根。掴まれた兄はその間（手のひら）に乗る（LOCKON.grab.palmRatio / broSeat） */
  rightHand: null as THREE.Object3D | null,
  rightFinger: null as THREE.Object3D | null,
  /** 兄の向き（yaw, rad） */
  broYaw: 0,
  /** カメラのオービット角（マウス操作）。yaw は「カメラが向いている方向」 */
  camYaw: Math.PI,
  camPitch: 0.12,
  /** 直近のカメラ位置（投擲カメラの側判定用） */
  camPos: new THREE.Vector3(),
  /** 最後にカメラ入力があった時刻（ms）。地上の「妹が気になる」引き戻しに使う */
  lastLookInput: 0,
  /** サイトの画面中心からのずれ（px）。溜め中はマウスでこれが動く */
  reticleX: 0,
  reticleY: 0,
  /** 兄がダッシュ（タックル・屋上ジャンプ）中か。残像エフェクト用 */
  broDash: false,
  /** 兄の右手の骨（生ボーン）。電撃の発射点 */
  broHand: null as THREE.Object3D | null,
  /** 地上の電撃が出ているか、その着弾点（兄がそちらを向いて腕を伸ばす） */
  lightningOn: false,
  lightningAim: new THREE.Vector3(),
  /** 地上：サイトが重なっている建物（colliders.list の添字。無ければ -1）。A で屋上へ跳ぶ。倒せる敵や電撃の的があれば -1 */
  roofTarget: -1,
  /** 地上：サイトが重なっている敵の id（無ければ -1、エネミービルは除く）。lockon が毎フレーム更新。輪郭が光り、A でその敵に乗る */
  rideTarget: -1,
  /** 乗っている敵の id（無ければ -1） */
  riding: -1,
  /** 地上：サイトが重なっている敵の id（高さ・距離を問わない。バルカンの自動照準用。無ければ -1） */
  aimTarget: -1,
  /** 地上：サイトが重なっている敵の弾（systems/projectiles の index。無ければ -1）。敵より近ければこちらを撃つ */
  aimProjectile: -1,
  /** 兄の頭の画面座標 [x, y, 画面内か]（吹き出し用。lockon が毎フレーム更新） */
  broScreen: [0, 0, false] as [number, number, boolean],
  /** 妹の頭の画面座標（吹き出し用） */
  imoutoScreen: [0, 0, false] as [number, number, boolean],
  /** 兄の乗降アニメ用の始点（ワールド） */
  mountStart: new THREE.Vector3(),
  mountDuration: 1,
}

const tmp = new THREE.Vector3()
export function shoulderWorld(out = tmp): THREE.Vector3 {
  if (!refs.shoulder) return out.set(0, 0, 0)
  return refs.shoulder.getWorldPosition(out)
}

const tmp2 = new THREE.Vector3()
/**
 * 妹の右手のひら（兄が掴まれて乗る位置）。手首と中指の付け根の間（LOCKON.grab.palmRatio）に、
 * 妹の向き基準のずらし（LOCKON.grab.broSeat：前・右・上、m）を足す。手の骨が無ければ肩
 */
export function handWorld(out = tmp): THREE.Vector3 {
  if (!refs.rightHand) return shoulderWorld(out)
  const gr = LOCKON.grab
  refs.rightHand.getWorldPosition(out)
  if (refs.rightFinger) {
    refs.rightFinger.getWorldPosition(tmp2)
    out.lerp(tmp2, gr.palmRatio)
  }
  const yaw = refs.imouto?.rotation.y ?? 0
  const fx = Math.sin(yaw)
  const fz = Math.cos(yaw)
  // 妹の右手側 = (-cos yaw, +sin yaw)（この世界は +z を向くと -x が右）
  out.x += fx * gr.broSeat.forward - Math.cos(yaw) * gr.broSeat.right
  out.z += fz * gr.broSeat.forward + Math.sin(yaw) * gr.broSeat.right
  out.y += gr.broSeat.up
  return out
}

// デバッグ用：コンソールから位置を確認できる
;(window as unknown as { __refs: typeof refs }).__refs = refs
