# いもーとコントロールダンディ

巨大な妹を遅刻させずに学校に送り届けるブラウザゲーム。仕様は `docs/SPEC.md`。

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ に出力（itch.io 用）
```

## 操作
| 入力 | 地上（兄） | 肩上 |
|---|---|---|
| WASD / 矢印 / 左スティック | カメラ基準で走る | W 妹を前進・A D 旋回（リモコン） |
| マウス（クリックでロック）/ 画面右ドラッグ | カメラ回転 | 妹の頭を中心に回転（顔が見える） |
| 左クリック長押し / Space | ジャンプ | サイトで敵をロック → 離して投擲 |
| 右クリック / Shift / E | どこからでも妹の肩へ飛び乗る | 飛び降りる |
| P | デバッグ俯瞰カメラ | 同左 |

`?viewer` を URL に付けるとモデル比較ビューアになる。

## モデル
`public/models/` 参照（ライセンスは `public/models/LICENSES.md`）。妹は pixiv の VRM サンプル、兄は VirtualCast の Seed-san を学生服風に色替え。差し替えは `src/config/game.ts` の `MODELS` を書き換える。

## 進捗
- [x] ステップ1：スケール検証（箱の妹60m＋カプセルの兄、乗降カメラ演出）→ `docs/screenshots/step1/`
- [x] プロトタイプ：VRM の妹（手続き歩行）、トゥーン塗りの兄、格子状の街、肩上で妹を操縦 → `docs/screenshots/proto/`
- [ ] ステップ2：制限時間と校門

## モデルのクレジット
- 妹（ショート）：VRoid Hub のモデル（作者名：要記入。利用条件：クレジット表記必要・個人の商用利用は非営利のみ）
- 妹（ロング）：VRM1_Constraint_Twist_Sample (c) pixiv Inc.（VRM Public License 1.0）
- 兄：Seed-san by VirtualCast, Inc.（VRM Public License 1.0）

モデルは Esc の調整パネル「モデル」で切り替えられます。追加は `public/models/` に置いて `src/config/game.ts` の MODEL_CHOICES に1行足すだけです。

## 引き継ぎメモ（2026-09-19 時点）
- 遊べる URL：https://mukkii-game.github.io/ImoteControllDandy/ （push で自動デプロイ）
- 操作：右クリック/Shift=乗降、左クリック長押し=サイトで敵をロックオン→離して投擲、1/2/3（テンキー可）=技、ホイール=技選択・ホイールクリック=発動、Esc/Tab=調整パネル
- 妹は自動で歩く（W 加速・S 減速・A D 旋回）。歩幅・速度は半分ずつ落とした状態。制限時間 11:00
- 揺れは停止中（CAMERA.shakeAmp = 0）。後で調整する
- 音：public/audio/se/ に効果音ラボの SE（出典は SOURCES.md）。無ければ合成音。VOICEVOX 音声と BGM は voices.json の名前で置けば鳴る
- モデル：妹は VRoid Hub のショート（public/models/custom/imouto.vrm、クレジット必要・作者名は未記入）。兄は Seed-san（ロボアーム非表示・服を黒く）。models/custom/bro.vrm を置けば差し替え
- 外部 glb（パトカー・戦車・戦闘機）は public/models/kit/manifest.json で差し替え可（README あり）
- 未着手：所沢ネタ、音声命令、デモムービー用 BGM、スマホ実機確認、投擲中の兄が小さい問題、ED の構図
- 調整した数値はすべて src/config/game.ts。Esc パネルの「変更をコピー」で JSON を出せる
