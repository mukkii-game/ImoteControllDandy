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
| マウス（クリックでロック）/ 画面右タッチ（仮想スティック：置いた所からずらした分が回る速さ） | カメラ回転 | 妹の頭を中心に回転（顔が見える） |
| 左クリック / Space | サイトが敵に重なっていればその敵の上へ跳んで乗る、ビルなら屋上へジャンプ、何も無ければサイトの向きへタックル（連打で高速移動）。電撃はボタン不要でサイトの敵・弾へ自動 | 長押しでサイトをロック → 離して投擲。押していない間はサイト中央の敵・弾へ自動で電撃 |
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
- 怪鳥トコロス：作者提供の GLB（Tripo で生成・Mixamo リグ、public/models/tokoros/tokoros.glb）
- 街（家・ビル）とパトカー：Kenney（www.kenney.nl）の City Kit Suburban / City Kit Commercial / Car Kit（CC0、表記任意）

モデルは Esc の調整パネル「モデル」で切り替えられます。追加は `public/models/` に置いて `src/config/game.ts` の MODEL_CHOICES に1行足すだけです。

## 検討事項メモ
- ロックオン攻撃（サイト→投擲）を肩上（上空）専用にするかどうか。今は肩上のみ。地上は高速タックル
- 打撃（タックル）と遠隔（投擲）の効果の差をどう付けるか（案は会話ログ参照：戦車は打撃のみ、遠隔はまとめ倍率、打撃で技ゲージ、など）
- 満洲・山田うどんの画像の権利（公開前に確認）
- ゲーム中 BGM（GiantLOLO）は仮。公開前に必ず差し替える（public/audio/bgm/play.mp3）
- 屋上ジャンプで複数の建物がサイトに重なった時の選び方：今は「見えている中で高い方」（BRO.roofJump.pick='tallest'）。手前優先（'nearest'）にするかは要検討
- ▼ をロックして「あそこへ行け」で行き先を指示する仕組み（製品版で入れるかも。今はオフ：GAME.dest.lockEnabled）。プロトは妹が自動で学校へ向かう（GAME.dest.autoNavigate）
- ネイティブアプリ化（スマホの重さ対策）。ブラウザ内では Three.js が既に最軽量級で、エンジンを替えても速くならない。速くなるのはネイティブ（Unity＝UniVRM で VRM がそのまま使える／Godot＝無料）に移した時で、目安 2〜5 倍。移すなら「遊びの設計が固まってから」。数値が src/config に集まっているので移植時にそのまま持っていける
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
- スマホは横画面で遊ぶ前提（systems/orientation.ts）：①スタートを押した時に全画面＋screen.orientation.lock('landscape')（Android Chrome。ユーザー操作の中でしか許可されない）②それでも縦のまま（自動回転オフ・iPhone の Safari・固定に失敗）なら、アプリ全体を CSS で 90° 回して横画面にする（html.rotated → .app を width:100dvh / height:100dvw で rotate(90deg)。アプリの上辺が画面の右側に来る＝スマホを左に倒して持つ向き）。回している間は指の動きの座標系が 90° ずれるので、タッチ入力は screenToApp() で直し（mouse.ts の視点スティック、VirtualPad の移動スティック）、画面の大きさは window.innerWidth ではなく appSize() を使う（Reticle / Speech / Bro のタックル方向）。R3F の Canvas は resize={{ offsetSize: true }}（見た目ではなく要素本来の大きさで計測）＋ StageScene の ViewSizer（向きが変わった後に setSize で入れ直す）③ホーム画面に追加（PWA）した時は public/manifest.webmanifest の orientation: landscape / display: fullscreen が効く。「横にしてね」の案内は廃止（縦でも横画面になるため）
- Esc/Tab はポーズ（フレームループ停止）＋調整パネル。スマホ（タッチ操作）はプレイ中の左上に「≡」ボタン（ui/VirtualPad.tsx の .menu-btn）が出て同じ働き。パネルの頭に「▶ 再開」ボタンもあり、パネル幅はスマホでは画面に収まる幅に縮む。ポーズ中は AudioContext を suspend して音を全部止める（BGM・電撃のループ・鳴りかけの SE も）。解除で resume
- 攻撃中の兄は光弾（芯 4.4m・ハロ 10m・粒 14m、レーザーのような光の軌跡 140 点、LOCKON.glow）。軌跡は戻ったあとフェードで消える（trailFadeSec）。肩に戻ると着地エフェクト（LOCKON.landFx）。最大ロック 16、ロック距離は無制限（画面に映っていれば）
- 飛行は「1 体あたりほぼ一定時間」（LOCKON.hopSec、遠いほど加速。パンツァードラグーンのレーザーと同じで距離無視）。ロック数で少し時間が変わるだけで、すぐ倒しきって戻る（returnSec 0.25）
- 地上サイト：倒せる敵（タックルの届く高さ・距離）に重なるとサイトが赤く太く光り（refs.groundTarget）、その時の左クリックはその敵へ全距離タックル。重なっていない時はサイトの向きへ半分の距離（BRO.tackle.missDistanceMul）
- 地上の移動速度は 21 m/s（BRO.runSpeed）。ダッシュ後のカメラは dashRecoverLerp（8）でゆっくり追いつき、dashRecoverSec（1 秒）かけて通常の速さ（followLerp 18）に戻る
- 右上の「地上／肩上」の下に fps 表示（ui/HUD.tsx の Fps）。カクつきの切り分け用：fps が低ければ描画の重さ、60 なのにカクつくなら動きの作り方
- 毎フレームの new THREE.Vector3 / Quaternion を減らした（Fighters の right、BroGlow の粒）。GC による周期的なカクつき対策
- 地上の上下の見回しは肩上より広め（CAMERA.ground.pitchMin/pitchMax。上 77° まで。頭上の敵を電撃で狙える）
- 電撃（entities/Lightning.tsx、BRO.lightning。旧バルカンの置き換え）：地上でも肩上でも、ボタン不要。肩上ではカメラを振り回してサイト（中央）に敵を入れれば撃つ。A を押して溜め（掴まれてロックオン）に入ると止まる（lockon.tsx の aimOn＝溜め中は照準を出さない）。サイトが敵の弾か敵を捉えると自動で、兄の右手（refs.broHand＝生ボーン rightHand）からそこへ山なりの電撃が伸びる。サイト内に弾があれば敵より弾を優先（lockon.tsx の aimProjectile）。当て続けた秒数で倒す（敵 killSec 2.0＝弱め、エネミービルのロック点 bossKillSec 4、敵の弾 projectileSec 0.12＝すぐ落ちる）。敵が動いても着弾点はついていき、倒れるまで続く。倒れたら次にサイトに入った敵へ。的が円形サイト（LOCKON.reticleRadius × ringLeeway）の外へ出たら追うのをやめて、次にサイトに入った敵へ。追っている最中でもサイトに敵の弾が入れば弾へ切り替え、落としたらまた狙い先を決め直す。乗っている敵は狙わない（lockon が除外）。見た目は 2 次ベジェ（中点を上へ arcUp、横へ arcSide × sin で揺れる）を segments 本の箱でつなぎ、各点を jitter でギザギザにずらす（jitterEverySec ごとに取り直し）。手元 nearWidth → 遠く farWidth に太くなる（thickenFrom〜thickenTo m）ので画面が塞がれない。外側は半透明の黄色、芯は黄白（coreRatio）。うねりは waveFreq / waveSpeed / waveAmp（ビームに沿った波が時間で流れる）。音は se.lightning（雷魔法3）を出ている間ループ（audio.ts の startLoop / stopLoop、lightning.start / stop イベント）。兄はその方向を向いて右腕を伸ばす（procAnim.applyAimPose）
- 敵に乗る（BRO.ride、Bro.tsx の ride / tk.rideTo）：サイトが敵（エネミービル以外、空中も）に重なるとその敵の輪郭が赤く光り（systems/highlight.tsx：敵の Object3D＝systems/enemies.ts の enemyObjects に各エンティティが毎フレーム登録、そのメッシュの複製をリムライトで重ねる。外部モデル無しの箱の警察・戦車は同じ大きさの箱で代用）、A でその敵の上へ山なりに跳んで乗る（sec 0.9、arcUp、topOffset は種類ごと）。乗っている間は敵と一緒に動き（refs.riding）、敵が死ねばそのまま落ちる。電撃はサイトの他の敵へ自動で出る。A（タックル／屋上ジャンプ）で降りる、B で妹へ。カメラは視点入力が止まって lookReturnDelaySec 後に妹の頭の方へ戻る（camera.tsx）
- タックルの速さは 120 m/s（BRO.tackle.speed）
- 屋上ジャンプ（BRO.roofJump）：地上で A を押した時、サイトに乗れる敵が無く、ビルが重なっていれば（ビルの輪郭が黄色く光る、サイトも黄色、refs.roofTarget）その建物の中心の真上へ山なりに跳んで屋上に着地。重力無視で距離によらず sec 秒（1.5）。上りに riseRatio（0.6）の時間、下りは残り＝1.5 倍速く落ちる。弧は arcUp 22m＋距離×0.22 で高い。着地で bro.land イベント→足元に黄色い波しぶきの輪（entities/LandFx.tsx、landFx）と着地音 se.jumpLand（land_jump.mp3、作者提供）。自分が乗っている建物と minDist（10m）より近い建物は対象外（後で調整）。判定は lockon.tsx がサイト中心と周り（aimRadius）の rays 本のレイで建物の箱（colliders.rayBuildings）を探し、レイごとに一番手前の建物だけを候補にして高い方（pick='tallest'）を選ぶ。minHeight（13m）未満の住宅は対象外＝ビルだけ。屋上の床は colliders.floorAt（その点を含む一番高い建物、住宅も含む）で、住宅の上に落ちてもめり込まず上に立つ。歩いて縁から出れば落ちる、建物が壊れれば落ちる。壁は buildingAt(…, aboveY) で「自分より高い建物」だけ。飛び降り・地上発の攻撃からの着地も床の高さへ
- 爆撃（FIGHTERS.bomb）：黒い爆弾が黄色い光をまとって、妹の胴体へゆっくり曲がりながら飛んでくる（speed / homing / gravity）。当たると被弾エフェクト＋減速。上空集合の旋回は半径 135m・高さ 210m（loiter.kinds.overhead）
- 吹っ飛び：地上の敵は上へ 160m/s、空中の敵は上へ 75m/s で勢いよく散ってから半分の重力で落ちる（DEBRIS.knockback / DEBRIS.air）
- 空の敵：戦闘機は 2 編隊（FIGHTERS.squadrons、各 7 機）が同時に別方向から。ヘリは 2 編隊 × 4 機（HELIS.groups / perGroup / formation）でまとまって妹の周りを回る。全体的に前より遠め（loiter.kinds の center、HELIS.keepDist 260）。戦闘機の速度は 220 m/s
- エリア（GAME.areas、仮の 4 分割・600m ずつ）：プロペ商店街 → 航空公園 → 米軍基地 → 小学校近辺。入ると画面中央（PAUSE と同じ位置）に巨大な地名を 3 秒（GAME.areaTitleSec、.area-title）。街の見た目の区間は別（GAME.terrain）。タイマーは右上に大きく（.timer）、その下にモード・スコア・fps・レーダー
- スタートは z=-1000（ビル街 z=-500 の手前）。エネミービルは 2 組：スタート先に右＝満洲・左＝山田うどん、学校との中間（z≈160〜260）にも道から左右 230m 離れて 1 組（BOSSES）。900m 手前から 5 m/s でゆっくり近づき（BOSS.aggroDist / creepSpeed）、体を左右に揺らし上半分がしなりながらにじり寄る（BOSS.sway）
- 怪鳥トコロス（entities/Tokoros.tsx、TOKOROS）：作者提供の GLB（Tripo 生成、Mixamo の骨 mixamorig:* 入り・アニメ無し、約 2000 三角形）。最初からいて、ロロの頭（頭の骨＋above）の高さで半径 orbitRadius・orbitSpeed でぐるぐる回る。うつぶせ（prone＝X 軸 90°、頭が進行方向・顔が下）。平泳ぎは骨の手続きアニメ（systems/tokorosRig.ts：位相 0..1 のキーフレーム TOKOROS.pose で腕の上げ下げ armElev・胸の前へ armSweep・肘 elbow・股関節 hip・膝 knee・脚の開き legOut・背中 spine。角度は「モデル座標の軸まわり」で与え、親のワールド回転でローカルに直す。GLTFLoader は骨名の ':' を落とすので両方の名前で探す）＋体全体の揺れ（stroke：蹴った直後に速くなる surge、上下 bob、うなずき pitch、ロール roll）。`?tokoros` で近くで確認できる開発ページ（dev/TokorosViewer.tsx。window.__tk.phase で位相を止める、__tk.cam でカメラ位置）。敵ではない（電撃・ロックの対象外）。助けに来る動きはこれから
- 敵の弾（ミサイル・砲弾）の速さは 14〜15 m/s（爆弾は 14）
- 被弾：SPEC 通り 0.5 秒減速（HIT.slowSec / slowFactor）＋驚き顔＋「いたっ」の声（line_imouto_hit、SOUND.hitVoiceMinGapSec で連呼を抑える）。ダメージは無い
- 敵の弾はミサイル型（灰色の胴体＋赤い先端、PROJECTILE.bodyRadius 0.9m）で黄色い光をまとい、速さは 28〜30 m/s。爆弾は黒い玉（FIGHTERS.bomb）。見た目は entities/Projectiles.tsx が登録簿（systems/projectiles.ts）からまとめて描く。妹の体への着弾は体の表面の点（imoutoImpact）で、爆発は兄と同じくらい（HIT.explosionRadius 5m）＋赤っぽい煙（HIT.puffs、オレンジ→赤→暗い赤）と、少し遅れて出る灰色の煙（HIT.grayPuffs / grayDelaySec）の 2 段。「痛っ」は効果音ラボの SE 5 種からランダム、鳴ったら 3 秒は鳴らさない（SOUND.hitVoiceMinGapSec）。タックル音は 2 種を順繰り（SOUND.tackleSounds）
- 敵の弾（爆弾・ミサイル・砲弾）は systems/projectiles.ts に登録され、地上の電撃で撃ち落とせる（サイトに入れば自動照準の対象、敵より優先。撃ち落とすと爆発＋BRO.vulcan.projectileScore）
- 「なぎ払え」（靴飛ばし、SKILLS.shoe）：右脚を後ろへ振りかぶって（windBackSec）から前へ蹴り出し（kickSec）、蹴り切った瞬間に靴が飛ぶ（skills.ts の tick で発射）。靴の真下には一定距離ごとに地面から火柱（pillar：高さ 85m、加算合成の円柱 2 重）。通り道の敵と建物（breakRadius）を壊し、破片と本体は通常の 2 倍の高さへ（power。enemy.hit / building.* の power で Debris が上向き速度を倍にする）
- 「泣け」（TEARS、entities/Tears.tsx）：「うえーんうえーん」の声と吹き出し、目から水色の涙の玉 70 個が四方へ一度に飛び散り、当たった敵は一撃（従来の全敵スタンもそのまま）
- 学校は超巨大（GAME.school：幅 900・高さ 220・時計塔 180）でフォグを受けない（fog={false}）。カメラ far 3400
- 軽量化その 3：260m より遠い区画は箱（STAGE.lodDist）、720m より遠い区画は描かない（drawDist）、フォグは 240〜720m（fogNear/fogFar）で drawDist と揃えて区画の出入りを隠す
- タイトルロゴは M PLUS Rounded 1c（Google Fonts、index.html で読み込み。オフラインなら OS の丸ゴシック）。副題「進め！ジャイアントロロ」
- 敵：戦闘機は 7 機の横に連なった編隊（FIGHTERS.formation）。並びは「ロロから見て画面の横」（視線に直交する向き）に付けるので、どの方向へ飛んでいても横一列に見える。方向別パスで来て、正面で「ロロの前を斜めに大きく横切る」動き（リサージュ、FIGHTERS.loiter.kinds の center/amp/speed）でしばらく滞在。まとめてサイトでなぞる想定。ヘリ 3 機は開始直後から妹の周りを一定距離で回って待機し撃つ（HELIS）。パトカーは妹に近づいて撃ち、近づかれると離れる（POLICE.keepDist/fleeDist）
- エネミービル（config/waves.ts の BOSSES：ぎょうざの満洲・山田うどん、顔画像は public/textures/）：出発地点の少し先の道に立ち、妹が近づくとにじり寄る。通り抜け不可。ロック点 4 つ（ビルの中に散らばる）を全部当てるか技で倒す。画像は仮（権利は要確認）
- 行き先は ▼（GAME.dest、今は校門）。妹は A D を触っていない間、自動で校門へ旋回する。▼ のロック指示はオフ。兄のセリフは吹き出し（SPEECH.lines：右へまわれ／左へ回れ／ロロップだ／蹴れ／泣け／オレを投げろ／あそこへ行け）
- 肩に乗った瞬間は妹の左側から見るカメラ（CAMERA.mountViewYaw）。妹の踏み潰し半径は横幅より少し大きい程度（GAME.crushRadius 8 / bodyRadius 7 / POLICE.stompRadius 9）
- 品質プリセット（QUALITY、systems/quality.ts）：低／中／高／自動。タイトル画面の「重さ」ボタン、Esc パネルの「品質」、URL の `?q=low|mid|high|auto`（`?lite` は低）のどれでも。選ぶと localStorage に保存。スマホ（タッチ操作）は何も選んでいなければ最初から低（QUALITY.touchDefault）。自動は開始 3 秒後から 5 秒の平均 fps で決める（25 未満＝低、45 未満＝中）。低＝影なし・描画解像度 0.6 倍・街は箱（敵の外部モデルも無し）・描画距離 380m・戦闘機 1 編隊・ヘリ 1 編隊・スモークなし・X 線輪郭なし・アンチエイリアスなし・トゥーン輪郭線なし（three-vrm は輪郭線を同じメッシュの追加マテリアル isOutline で描くので、その material.visible を落とす＝キャラを 2 回描かない）・髪の物理は 2 フレームに 1 回・フレーム上限 30。中＝影なし・解像度 1 倍・描画距離 600m。高＝影あり（2048 の影マップ）。描画解像度はどのプリセットでも最大フルHD（1920×1080）で頭打ち。プリセットが変わると街・ヘリ・影ライトは作り直し（key）。アンチエイリアスだけは WebGL の作成時に決まるので再読み込みで反映。フレームループは自前（StageScene の FrameLimiter：R3F を frameloop='never' にして requestAnimationFrame から advance(秒) を呼ぶ。Canvas の frameloop プロップも "never" にしておくこと＝品質切替などで Canvas が再設定されるとプロップの値に戻され、R3F 自身のループも回り出してポーズが効かなくなった（2026-09-20 に修正）。再設定で時計が 0 に戻った時は elapsedTime を合わせ直す。'never' では R3F が「渡した秒−前回の秒」を dt にするので ms ではなく秒を渡す。maxFps で上限、Esc 中は止めて解除時に clock.elapsedTime を合わせ直す＝止まっていた時間が一気に進まない）。VRM の更新は systems/vrmUpdate.ts（髪の物理の間引きと輪郭線の表示切替）
- 重さの調べ方：`window.__gl`（three の renderer。`__gl.info.render.calls` が描画回数、`.triangles` が三角形数、`__gl.info.programs.length` がシェーダー数）と `window.__scene` を Playwright から読める。CPU プロファイルは scratchpad の prof.mjs のように CDP の Profiler で取る。2026-09-20 時点の計測：描画回数 約 250・三角形 約 60〜90 万・シェーダー 58 本（GPU 側は軽い）。JS 側で重かったのは「肩の表面を探すレイキャスト」（スキンメッシュ約 5 万頂点を全部ボーン変形するので 1 回 30ms 超。0.2 秒ごとに撃っていた → 飛び乗り開始の 1 回だけに。IMOUTO.shoulderProbeInterval=0）と「初めて映ったマテリアルのシェーダーコンパイル」（初乗り時に 0.5 秒停止 → StageScene の Precompile がモデル読み込み完了時に gl.compileAsync で先読み）
- タイトル画面と Esc パネルに「GPU: …」と、ブラウザが使っている GPU の名前を出す（WEBGL_debug_renderer_info、systems/quality.ts の gpu）。「SwiftShader」＝ソフト描画（ハードウェアアクセラレーションがオフ）、「Intel … UHD/Iris」＝内蔵 GPU で動いている、という切り分けに使う。重いと言われたらまずこれのスクショをもらう
- ヘッドレス Chromium は通常モードだと 1fps 未満（自動テストは `?lite`）
- サイトはパンツァードラグーン式：肩上では最初から（溜めていなくても）マウス／タッチでサイト自体が動き、画面端に寄るとカメラがその方向へ回る（LOCKON.reticle。lockon.tsx の shoulderAim、mouse.ts の applyLook）。溜め中（A 長押し）はサイトの輪がオレンジに変わる（.reticle-layer.charging）。攻撃中はカメラを変えない（CAMERA.thrown.enabled = false）。1 体目まではベジェ曲線で回り込む（LOCKON.curve）
- タッチの視点操作は仮想右スティック（CAMERA.touchStick、systems/mouse.ts の touchLookTick を lockon.tsx の useFrame から毎フレーム呼ぶ）：画面（パッド以外）に指を置いた点が中心、そこからのずれ（半径 radius px で最大）が「回る速さ」になり、押している間ずっと回る。溜め中はサイトの速さ、地上はサイト（左右）＋カメラ（上下）。以前の「マウスと同じくずらした分だけ回る」方式は指が画面端で止まるので少ししか回れなかった（enabled=false で戻せる、その時は touchSensitivity）
- 敵セット（仮）：戦闘機は config/waves.ts の FIGHTERS.passes（前から→左から→右後ろから）を順に回り、次の方向へ抜けていく。編隊は FIGHTERS.formation で上下前後にばらす。戦車は 1 グループごとに左右を入れ替える。本格的なエネセットは別途計画
- 妹は自動で歩く（W 加速・S 減速・A D 旋回）。歩幅・速度は半分ずつ落とした状態。制限時間 11:00
- 揺れは停止中（CAMERA.shakeAmp = 0）。後で調整する
- 兄の声（作者提供、2026-09-20）：溜め開始「ねらえ！」（line.bro.throw → line_bro_nerae.wav、吹き出しも SPEECH.lines.throw）、飛び乗り「さあいくぞ」（bro.mount → bro_ikuzo.mp3）、飛び降り「お相手しましょう」（bro.dismount → bro_oaite.mp3）。ファイル名は添付順から推定したので、入れ違っていたら voices.json の 2 行を入れ替える
- 音：public/audio/se/ に効果音ラボの SE（出典は public/audio/se/SOURCES.md）。無ければ合成音。ロックオン＝決定ボタンを押す26、玉の発射（肩上）＝雷魔法4、建物が壊れた＝2 種類をランダム（一歩で何軒も潰れるので SOUND.building.minGapSec より短い間隔では鳴らさない）。ゲーム中 BGM は public/audio/bgm/play.mp3（GiantLOLO。知人からもらった仮の曲で、公開時に差し替え必須）。音量は SOUND（game.ts。masterVolume 0.5 が全体に掛かる）
- 射撃モードで妹と兄を消す処理は今はオフ（CAMERA.aim.vanish=false。true に戻すと短いフェードで消える：fadeSec / showFadeSec、systems/silhouette.ts の blend）。代わりに X 線輪郭（CAMERA.aim.xray、systems/xray.tsx）：溜め中・攻撃中は、妹の体や建物の向こうに隠れている敵の「隠れた部分の縁」だけが緑に光る。仕組みは敵メッシュの複製を深度テスト逆（GreaterDepth）＋リムライトで描く。対象は XrayRoot で包んだまとまり（戦闘機・ヘリ・パトカー/戦車。エネミービルは大きすぎて縁が変に見えるので対象外）。見せるのは「カメラ→敵の線が妹の体（半径 occluderRadius・高さ occluderHeight の円柱）を通る敵」だけ。建物に隠れた敵や隠れていない敵には出ない
- 掴んで投げる（LOCKON.grab / windupSec）：ロックオンのボタンを押すと妹が右手で兄を掴む（肘をへそ辺りで曲げた構え、兄は手のひらの上：refs.rightHand）。離して発射すると振りかぶり→振り抜きの投げモーション（windupSec 0.45 秒）の間は手に握られたままで、終わった瞬間に手から発射。腕は returnSec で歩きに戻る。ポーズの数値は grab.hold / windBack / release（lower の y はマイナスで肘が体の前に曲がる）。兄は手首と中指の付け根の間（palmRatio）＝手のひらの上に乗り、そこから妹の向き基準で前・右・上へずらせる（grab.broSeat）。指は fingerCurl で握る（投げ切る瞬間に開く）。Esc パネルの「掴み」で兄の位置・腕の構えを見ながら調整でき、「変更をコピー」の JSON をそのまま渡せば反映する
- モデル：妹は VRoid Hub のショート（public/models/custom/imouto.vrm、クレジット必要・作者名は未記入）。兄は Seed-san（ロボアーム非表示・服を黒く）。models/custom/bro.vrm を置けば差し替え
- 街と車：Kenney（CC0）の City Kit Suburban / Commercial / Car Kit を public/models/kit/ に置き、家・ビル（STAGE.kit）とパトカー（manifest.json）に使用。戦車・戦闘機はまだプリミティブ（manifest.json に glb を書けば差し替わる）
- 破壊表現：家は屋根が飛び壁の破片が散る、ビルはブロックに砕ける、敵は部品が飛び散り黒煙（DEBRIS）
- 未着手：所沢ネタ、音声命令、デモムービー用 BGM、スマホ実機確認、投擲中の兄が小さい問題、ED の構図、戦闘機・戦車の glb、打撃と遠隔の効果の差
- 調整した数値はすべて src/config/game.ts。Esc パネルの「変更をコピー」で JSON を出せる
