# 絵と 3D モデルの作り方（ComfyUI ＋ ほぼ無料）

> 方針：お金をかけない（ROADMAP 0 章）。作者の PC（RTX 3080）で ComfyUI を動かす。
> 絵柄の方向は SPEC 3.1 / 3.2：**妹ロロ＝『ななこSOS』ライク＋アニメ版『ど根性ガエル』京子ちゃんの下膨れ**、**兄＝『バビル2世』ライクの学ラン**。
> 線引き：絵柄・空気感は借りる。**元作品の画像を生成の入力にしない。プロンプトに作品名・作者名・キャラ名を入れない**。必ず作者の手描きラフを通す。

---

## 全体の流れ

```
①なぞり用紙に手描きラフ（作者）
      ↓
②ComfyUI で三面図に清書（作者の PC。ワークフローは tools/comfy）
      ↓   良い 1 枚を選んでチャットへ
③三面図を 3 枚に切る（tools/split_sheet.py。私がやってもよい）
      ↓
④-a 主役（妹・兄）：VRoid Studio で三面図を見ながら作る → VRM   ← おすすめ（表情・髪揺れ込み）
④-b メカ・小物：ComfyUI の 3D テンプレートで画像から 3D → glb
      ↓   ファイルを public/models/... に置いて push、または チャットに添付
⑤私がゲームに組み込み、トゥーン化・大きさ合わせ
```

主役を「画像から 3D」で作らず VRoid にするのは、表情（まばたき・口）と髪・スカートの揺れが最初から付いているから。画像から 3D の結果は形の参考にとどめる（④-b の道具で試すのは自由）。

---

## 0. 準備（1 回だけ）

### ComfyUI を入れる
- **ComfyUI Desktop**（公式のインストーラ版、Windows・NVIDIA 用）を comfy.org から入れるのが一番簡単。モデルの置き場所は、インストール時に選んだフォルダの中の `models/`
- 起動して画面が出れば OK

### モデルをダウンロードして置く

| 何 | どこから（Hugging Face） | 置き場所 | 名前を変える |
|---|---|---|---|
| 絵のモデル（アニメ絵の SDXL） | `cagliostrolab/animagine-xl-4.0` の .safetensors | `models/checkpoints/` | `animagine-xl-4.0.safetensors` |
| ポーズを守らせる ControlNet | `xinsir/controlnet-openpose-sdxl-1.0` の `diffusion_pytorch_model.safetensors` | `models/controlnet/` | `controlnet-openpose-sdxl-xinsir.safetensors` |
| 体の形を守らせる ControlNet（任意） | `xinsir/controlnet-depth-sdxl-1.0` の `diffusion_pytorch_model.safetensors` | `models/controlnet/` | `controlnet-depth-sdxl-xinsir.safetensors` |
| 3D：三面図から形（任意） | ComfyUI のテンプレート「HY 3D 2.0 MV Turbo」を開くと案内が出る（約 4.6GB） | `models/checkpoints/` | そのまま |
| 3D：1 枚から色付き（任意、メカ用） | テンプレート「Pixal3D & TRELLIS.2」を開くと案内が出る（合計約 15GB） | 案内どおり | そのまま |

名前を変えなくても、ワークフローを開いた後に各ノードのプルダウンで選び直せば動く。

### 下敷き画像を ComfyUI に入れる
リポジトリの `tools/pose_sheets/` の PNG を、ComfyUI の `input/` フォルダにコピーする（GitHub Desktop で pull 済みならリポジトリのフォルダから）。

| ファイル | 中身 | 使い道 |
|---|---|---|
| `imouto_openpose.png` / `bro_openpose.png` | 正面・横・後ろの骨格線（A ポーズ） | ControlNet（ポーズ）に入れる |
| `imouto_depth.png` / `bro_depth.png` | 同じポーズの奥行き | ControlNet（体の形）に入れる。強くすると今のモデルの体型に寄る |
| `imouto_trace.png` / `bro_trace.png` | 薄い三面図 | **手描きラフのなぞり用紙** |
| `*_shade.png` / `*_sil.png` | 色付き / シルエット | 参考 |

下敷きは今の VRM から自動で作っている（`?posesheet&who=imouto&mode=openpose`、書き出しは `tools/pose_sheets.mjs`）。妹の頭は `POSE_SHEET.headScale` で 1.18 倍にしてある（5〜6 頭身寄り）。

---

## 1. 最初の 1 枚（まず動かす）

1. ComfyUI に `tools/comfy/ui/roro_sheet.json` をドラッグ＆ドロップ（開けない時は `tools/comfy/roro_sheet.json`）
2. 「Load Image」ノードが `imouto_openpose.png` になっているのを確認
3. 右上の **Run**（実行）。4 枚出る（RTX 3080 で 1〜2 分の目安）
4. 出た絵は ComfyUI の `output/` フォルダに `roro_sheet_*.png` で保存される

うまく三面図にならない時：
- ControlNet の `strength` を 0.9 → 1.0、`end_percent` を 0.85 → 1.0 に上げる
- 体型を今のモデルに寄せたい時は `roro_sheet_depth.json`（奥行きも使う版）

兄は `bro_sheet.json`。

---

## 2. 手描きラフから清書（ここが本番）

AI 任せにせず、作者の絵を必ず入れる。これが絵の個性と権利の両方を守る。

1. `imouto_trace.png` を印刷するか、お絵描きアプリ（アイビスペイント・クリスタ・Krita）の下の層に置く
2. 上の層に、正面・横・後ろのロロを描く。雑でよい。大事なのは：
   - **顔の輪郭（下膨れの頬）**、目の大きさと位置、髪型、カチューシャ
   - 服（「ロロ」T シャツか、セーラー系か）と色（大まかに塗る）
   - 等身（5〜6 頭身）
3. 画像を `my_rough.png` という名前で ComfyUI の `input/` に置く（1536×1024 に近い横長。違っても自動で合わせる）
4. `tools/comfy/ui/roro_from_rough.json` を開いて Run
5. **`denoise`（KSampler の中）で AI の変え具合を調整**：0.45＝ほぼラフのまま整える、0.6＝標準、0.75＝AI がかなり描き直す
6. 気に入ったものの「顔だけ」「服だけ」を手描きで直して、もう一度 4〜5（キャッチボール）

兄は `bro_trace.png` → `bro_from_rough.json`。学ランの詰襟、細身で脚長、なびく髪、を描く。

### プロンプト（言葉の指示）を変える時
「CLIP Text Encode」ノードの上が描いてほしいもの、下が描いてほしくないもの。英語のタグをカンマで並べる。
- 昭和っぽさ：`retro artstyle, 1980s (style), 1970s (style), anime screencap, cel shading, flat color, thick outlines`
- 妹の顔：`round face, puffy cheeks, chubby cheeks, large eyes`
- 兄：`gakuran, black school uniform, standing collar, slender, long legs, windswept hair, sharp eyes`
- **入れてはいけない**：作品名・作者名・キャラ名（ななこ、吾妻、バビル 等）

### 気に入った絵ができたら
- 画像をこのチャットに添付（または `docs/art/` に置いて push）
- その絵の **seed（KSampler の数字）** をメモしておくと、同じ絵を出し直せる

---

## 3. 3D にする

### 3-a 主役：VRoid Studio（無料、おすすめ）
1. VRoid Studio を入れる（pixiv、無料）
2. 「新規作成」→ 女の子 / 男の子
3. 三面図を横に表示しながら、顔（輪郭・頬のふくらみ・目の大きさ）、体型（頭身・脚の長さ）をスライダーで合わせる
   - 下膨れ：顔 → 輪郭の「頬」系のスライダーを上げ、あごを短く
   - 頭身：体型 → 頭の大きさを上げる
4. 髪は「髪型エディタ」で、前髪・横・後ろを三面図に合わせて描く
5. 服・目・顔のテクスチャは、三面図から色を拾って塗る（テクスチャの画像を書き出して、お絵描きアプリで描いて読み込み）
6. **VRM で書き出す**（VRM 0.0 でも 1.0 でも可）。ファイル名 `imouto.vrm` / `bro.vrm`
7. `public/models/custom/` に置いて push → 私が組み込む（コード変更なしで差し替わる作り）

VRoid の操作で詰まったら、画面のスクショをチャットに貼れば次の一手を書く。

### 3-b メカ・小物：ComfyUI の 3D テンプレート
- ComfyUI の左の「Templates」→「3D Model」
  - **Pixal3D & TRELLIS.2: Image to Model**：1 枚の絵から色付きの 3D（背景除去・減ポリ・UV まで自動）。メカ・建物・小物向き
  - **HY 3D 2.0 MV Turbo**：正面・左・後ろ・右の絵から形だけ（色なし）。三面図は `python3 tools/split_sheet.py 三面図.png 出力フォルダ` で 3 枚に切れる（左用の反転画像も作る）
- 名前に「API」と付くテンプレート（Tripo・Meshy・Rodin・Hunyuan の API 版）は**有料のクレジットを使う**。ほぼ無料方針では使わない（どうしても品質が要る 1 体だけ、の例外扱い）
- 出力の .glb を `public/models/` の下（例：`public/models/mecha/tank.glb`）に置いて push、またはチャットに添付

### 3-c Tripo（Web）
作者のアカウントで無料枠を使うのは可。**無料枠で作ったモデルの商用利用・公開範囲の条件は Tripo の規約を確認**（有料プランが必要な場合あり）。

---

## 4. 使っている AI モデルとライセンス（公開前に全部確認して ✔ を付ける）

| 道具 | 用途 | ライセンス（要確認） | 確認 |
|---|---|---|---|
| Animagine XL 4.0 | 絵 | CreativeML Open RAIL++-M（生成物の商用利用は可、利用制限あり） | [ ] |
| xinsir ControlNet（openpose / depth） | ポーズ・形 | Apache-2.0 | [ ] |
| Hunyuan3D 2.0 / 2.1 | 画像から 3D | Tencent Hunyuan Community License（地域・規模の制限あり。日本は対象内のはず） | [ ] |
| TRELLIS.2 / Pixal3D | 画像から 3D | 要確認 | [ ] |
| VRoid Studio | 主役モデル | pixiv の利用規約（作ったモデルは作者のもの） | [ ] |
| Tripo（使った場合） | 画像から 3D | プランごとの規約 | [ ] |

別のモデル・LoRA を足したら、ここに 1 行足す。

---

## 5. 私（AI）に頼めること
- 下敷きの作り直し（ポーズ・頭身・横顔の向きを変える：`POSE_SHEET` の数値）
- 三面図の切り分け、背景抜き、色の抽出
- 届いた VRM / glb の組み込み、大きさ・向き合わせ、トゥーン化、テクスチャの差し替え（tools/vrm_textures.py）
- プロンプトの調整案（出た絵を見せてくれれば、どのタグを足す・消すかを書く）
