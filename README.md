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
| 左クリック / Space | サイトの向きへ高速タックル（連打で高速移動） | 長押しでサイトをロック → 離して投擲 |
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
- 音声：VOICEVOX:青山龍星（兄・熱血スタイル）、VOICEVOX:満別花丸（妹・元気スタイル）。Web 版 VOICEVOX API で生成（詳細は SOURCES.md）
- 街（家・ビル）とパトカー：Kenney（www.kenney.nl）の City Kit Suburban / City Kit Commercial / Car Kit（CC0、表記任意）

モデルは Esc の調整パネル「モデル」で切り替えられます。追加は `public/models/` に置いて `src/config/game.ts` の MODEL_CHOICES に1行足すだけです。

## 検討事項メモ
- ロックオン攻撃（サイト→投擲）を肩上（上空）専用にするかどうか。今は肩上のみ。地上は高速タックル
- 打撃（タックル）と遠隔（投擲）の効果の差をどう付けるか（案は会話ログ参照：戦車は打撃のみ、遠隔はまとめ倍率、打撃で技ゲージ、など）
- 満洲・山田うどんの画像の権利（公開前に確認）
- ▼ をロックして「あそこへ行け」で行き先を指示する仕組み（製品版で入れるかも。今はオフ：GAME.dest.lockEnabled）。プロトは妹が自動で学校へ向かう（GAME.dest.autoNavigate）
- 肩上から玉（兄）を発射したあと、妹の体で玉が隠れる問題。暫定は「兄が戻るまで妹を消したまま」（CAMERA.aim.hideDuringThrow）。別案：地上のダッシュと同じく、カメラが兄を遅れて追いかける（CAMERA.thrown.enabled と dashFollowLerp 相当の値で試せる）

## 引き継ぎメモ（2026-09-19 時点）
- 重さ対策：建物は 3 ブロック四方の区画 × 種類ごとに InstancedMesh を分け、画面外はカリング、1100m より遠い区画は非表示、影は 260m 以内の区画だけ（STAGE.chunkBlocks/drawDist/shadowDist）。開始 5 秒の平均 fps が 32 未満なら影を切って解像度 1 倍（STAGE.autoLiteFps）。当たり判定は区画索引（systems/colliders.ts）で近くだけ調べる
- 地上：A（左クリック）でカーソル（カメラ）の向きへ高速タックル（BRO.tackle）。自分の背丈の弧で一定距離、敵で止まらず全部倒す、建物で止まる、連打で高速移動。歩きも建物は貫通不可。地上の自動カメラ引き戻しはオフ（CAMERA.ground.pullEnabled）
- 兄の攻撃でやられた地上の敵は本体が食らった方向へノックバックして上へ派手に吹っ飛ぶ（DEBRIS.knockback）。空中の敵（戦闘機・ヘリ）はその場で爆発してモデルが離散し、半分の重力でパラパラ落ちる（DEBRIS.air）
- 戦闘機のウエーブ：FIGHTERS.passes を順に回す。滞在の種類 near（近くで旋回）／far（遠くで旋回）／overhead（ロロの上空に集まって旋回し爆弾を落とす。ロロにダメージは無く被弾エフェクトだけ）。上空集合のときはプレイヤーが上を向いてまとめてロックする想定
- 地上でもサイトを表示（左右にだけ動く。タックルの向き）。肩上で溜めると射撃モード：妹も兄も同じ色のシルエットになりながら一瞬で消える（systems/silhouette.ts、深度だけ先に書いて一番手前だけ塗る方式なので口や歯が透けない）。カメラはそのまま（CAMERA.aim.cameraEnabled=false）
- セリフ：兄の吹き出しは 44px、妹は 40px（SPEECH.fontPx）。技は吹き出し（＋声）→1 秒後に発動（SPEECH.skillDelaySec）。投擲の「オレを投げろ！」は溜め開始時。妹は投げる時「そおれっ」、スキップ「ロロップロロップー」、靴「えいやっ！」、タイトルであくび。音声は VOICEVOX（SOURCES.md）。
- 地上：サイトは左右に動き、カメラが遅れて追いつく（LOCKON.reticle.groundFollow）。ダッシュ中はカメラがわざと遅れて追いつく（CAMERA.ground.dashFollowLerp）。光弾は小さな芯＋粒（LOCKON.glow.sparkles）に
- レーダーマップ（右上、半透明、RADAR）：中心はロロでロロの向きが上。650m の範囲。兄＝水色、雑魚＝小さい点（空中は黄）、エネミービル＝大きい赤点
- タックル中と飛び乗り中は残像と光の尾（BRO.afterimage、entities/BroAfterimage.tsx）
- 軽量化その 2：道路のセンターラインを 1 つの InstancedMesh に（以前は 5,000 個以上の別メッシュ）。520m より遠い区画は箱で描く LOD（STAGE.lodDist）。影のカメラ far を 420 に
- 遊べる URL：https://mukkii-game.github.io/ImoteControllDandy/ （push で自動デプロイ）
- 操作：右クリック/Shift=乗降、肩上は左クリック長押し=サイトで敵をロックオン→離して投擲、地上は左クリック=サイトの向きへ高速タックル、1/2/3（テンキー可）=技、ホイール=技選択・ホイールクリック=発動、Esc/Tab=ポーズ＋調整パネル
- Esc/Tab はポーズ（フレームループ停止）＋調整パネル
- 攻撃中の兄は光弾（オーラ半径 12m＋加算合成の太い光の軌跡、LOCKON.glow）。最大ロック 16、飛行速度 900
- 敵：戦闘機は 7 機の横に連なった編隊（FIGHTERS.formation）。並びは「ロロから見て画面の横」（視線に直交する向き）に付けるので、どの方向へ飛んでいても横一列に見える。方向別パスで来て、正面で「ロロの前を斜めに大きく横切る」動き（リサージュ、FIGHTERS.loiter.kinds の center/amp/speed）でしばらく滞在。まとめてサイトでなぞる想定。ヘリ 3 機は開始直後から妹の周りを一定距離で回って待機し撃つ（HELIS）。パトカーは妹に近づいて撃ち、近づかれると離れる（POLICE.keepDist/fleeDist）
- エネミービル（config/waves.ts の BOSSES：ぎょうざの満洲・山田うどん、顔画像は public/textures/）：出発地点の少し先の道に立ち、妹が近づくとにじり寄る。通り抜け不可。ロック点 4 つ（ビルの中に散らばる）を全部当てるか技で倒す。画像は仮（権利は要確認）
- 行き先は ▼（GAME.dest、今は校門）。妹は A D を触っていない間、自動で校門へ旋回する。▼ のロック指示はオフ。兄のセリフは吹き出し（SPEECH.lines：右へまわれ／左へ回れ／ロロップだ／蹴れ／泣け／オレを投げろ／あそこへ行け）
- 肩に乗った瞬間は妹の左側から見るカメラ（CAMERA.mountViewYaw）。妹の踏み潰し半径は横幅より少し大きい程度（GAME.crushRadius 8 / bodyRadius 7 / POLICE.stompRadius 9）
- URL に `?lite` を付けると街の外部モデルと影を切る（低スペック機・自動テスト用。ヘッドレス Chromium は通常モードだと 1fps 未満）
- サイトはパンツァードラグーン式：溜め中はマウスでサイト自体が動き、画面端に寄るとカメラがその方向へ回る（LOCKON.reticle）。攻撃中はカメラを変えない（CAMERA.thrown.enabled = false）。1 体目まではベジェ曲線で回り込む（LOCKON.curve）
- 敵セット（仮）：戦闘機は config/waves.ts の FIGHTERS.passes（前から→左から→右後ろから）を順に回り、次の方向へ抜けていく。編隊は FIGHTERS.formation で上下前後にばらす。戦車は 1 グループごとに左右を入れ替える。本格的なエネセットは別途計画
- 妹は自動で歩く（W 加速・S 減速・A D 旋回）。歩幅・速度は半分ずつ落とした状態。制限時間 11:00
- 揺れは停止中（CAMERA.shakeAmp = 0）。後で調整する
- 音：public/audio/se/ に効果音ラボの SE（出典は public/audio/se/SOURCES.md）。無ければ合成音。ロックオン＝決定ボタンを押す26、玉の発射（肩上）＝雷魔法4、建物が壊れた＝2 種類をランダム（一歩で何軒も潰れるので SOUND.building.minGapSec より短い間隔では鳴らさない）。ゲーム中 BGM は public/audio/bgm/play.mp3（GiantLOLO、作者提供）。音量は SOUND（game.ts）
- 射撃モードの消え方／戻り方は短いフェード（CAMERA.aim.fadeSec / showFadeSec）：前半はモデルがシルエット色に染まり、後半はシルエットが薄れて消える。戻るときは逆順（systems/silhouette.ts の blend）
- モデル：妹は VRoid Hub のショート（public/models/custom/imouto.vrm、クレジット必要・作者名は未記入）。兄は Seed-san（ロボアーム非表示・服を黒く）。models/custom/bro.vrm を置けば差し替え
- 街と車：Kenney（CC0）の City Kit Suburban / Commercial / Car Kit を public/models/kit/ に置き、家・ビル（STAGE.kit）とパトカー（manifest.json）に使用。戦車・戦闘機はまだプリミティブ（manifest.json に glb を書けば差し替わる）
- 破壊表現：家は屋根が飛び壁の破片が散る、ビルはブロックに砕ける、敵は部品が飛び散り黒煙（DEBRIS）
- 未着手：所沢ネタ、音声命令、デモムービー用 BGM、スマホ実機確認、投擲中の兄が小さい問題、ED の構図、戦闘機・戦車の glb、打撃と遠隔の効果の差
- 調整した数値はすべて src/config/game.ts。Esc パネルの「変更をコピー」で JSON を出せる
