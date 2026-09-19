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
- 街（家・ビル）とパトカー：Kenney（www.kenney.nl）の City Kit Suburban / City Kit Commercial / Car Kit（CC0、表記任意）

モデルは Esc の調整パネル「モデル」で切り替えられます。追加は `public/models/` に置いて `src/config/game.ts` の MODEL_CHOICES に1行足すだけです。

## 引き継ぎメモ（2026-09-19 時点）
- 遊べる URL：https://mukkii-game.github.io/ImoteControllDandy/ （push で自動デプロイ）
- 操作：右クリック/Shift=乗降、左クリック長押し=サイトで敵をロックオン→離して攻撃（肩上は妹が投げる・地上は兄が自力で跳ぶ、近い敵はパンチ）、1/2/3（テンキー可）=技、ホイール=技選択・ホイールクリック=発動、Esc/Tab=調整パネル
- Esc/Tab はポーズ（フレームループ停止）＋調整パネル。左クリック長押し中は兄の近くへ寄る照準カメラになり妹は半透明（CAMERA.aim）
- 攻撃中の兄は光弾（光の球＋加算合成の光る軌跡、LOCKON.glow）。最大ロック 8、飛行速度 520
- 敵：戦闘機は最初から出て方向別パスで来て正面付近でしばらく旋回滞在（FIGHTERS.loiter）。ヘリ 3 機は開始直後から妹の周りを一定距離で回って待機し撃つ（HELIS）。パトカーは妹に近づいて撃ち、近づかれると離れる（POLICE.keepDist/fleeDist）
- エネミービル（config/waves.ts の BOSSES：ぎょうざの満洲・山田うどん、顔画像は public/textures/）：出発地点の少し先の道に立ち、妹が近づくとにじり寄る。通り抜け不可。ロック点 4 つ（ビルの中に散らばる）を全部当てるか技で倒す。画像は仮（権利は要確認）
- 行き先は ▼（GAME.dest、今は校門）。溜め中に ▼ をサイトに入れて離すと「あそこへ行け！」で妹がそちらへ旋回（A D を触ると上書き）。兄のセリフは吹き出し（SPEECH.lines：右へまわれ／左へ回れ／ロロップだ／蹴れ／泣け／オレを投げろ／あそこへ行け）
- 肩に乗った瞬間は妹の左側から見るカメラ（CAMERA.mountViewYaw）。妹の踏み潰し半径は横幅より少し大きい程度（GAME.crushRadius 8 / bodyRadius 7 / POLICE.stompRadius 9）
- URL に `?lite` を付けると街の外部モデルと影を切る（低スペック機・自動テスト用。ヘッドレス Chromium は通常モードだと 1fps 未満）
- サイトはパンツァードラグーン式：溜め中はマウスでサイト自体が動き、画面端に寄るとカメラがその方向へ回る（LOCKON.reticle）。攻撃中はカメラを変えない（CAMERA.thrown.enabled = false）。1 体目まではベジェ曲線で回り込む（LOCKON.curve）
- 敵セット（仮）：戦闘機は config/waves.ts の FIGHTERS.passes（前から→左から→右後ろから）を順に回り、次の方向へ抜けていく。編隊は FIGHTERS.formation で上下前後にばらす。戦車は 1 グループごとに左右を入れ替える。本格的なエネセットは別途計画
- 妹は自動で歩く（W 加速・S 減速・A D 旋回）。歩幅・速度は半分ずつ落とした状態。制限時間 11:00
- 揺れは停止中（CAMERA.shakeAmp = 0）。後で調整する
- 音：public/audio/se/ に効果音ラボの SE（出典は SOURCES.md）。無ければ合成音。VOICEVOX 音声と BGM は voices.json の名前で置けば鳴る
- モデル：妹は VRoid Hub のショート（public/models/custom/imouto.vrm、クレジット必要・作者名は未記入）。兄は Seed-san（ロボアーム非表示・服を黒く）。models/custom/bro.vrm を置けば差し替え
- 街と車：Kenney（CC0）の City Kit Suburban / Commercial / Car Kit を public/models/kit/ に置き、家・ビル（STAGE.kit）とパトカー（manifest.json）に使用。戦車・戦闘機はまだプリミティブ（manifest.json に glb を書けば差し替わる）
- 破壊表現：家は屋根が飛び壁の破片が散る、ビルはブロックに砕ける、敵は部品が飛び散り黒煙（DEBRIS）
- 未着手：所沢ネタ、音声命令、デモムービー用 BGM、スマホ実機確認、投擲中の兄が小さい問題、ED の構図、戦闘機・戦車の glb、打撃と遠隔の効果の差
- 調整した数値はすべて src/config/game.ts。Esc パネルの「変更をコピー」で JSON を出せる
