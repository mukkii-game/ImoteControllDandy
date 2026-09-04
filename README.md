# いもーとコントロールダンディ

巨大な妹を遅刻させずに学校に送り届けるブラウザゲーム。仕様は `docs/SPEC.md`。

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ に出力（itch.io 用）
```

## 操作（ステップ1）
- WASD / 矢印 / 左の仮想スティック：兄の移動
- Shift / E / 画面右のBボタン：妹の足元で「乗る」、肩上で「降りる」

## 進捗
- [x] ステップ1：スケール検証（箱の妹60m＋カプセルの兄、乗降カメラ演出）→ `docs/screenshots/step1/`
- [ ] ステップ2：一本道＋妹オート歩行＋制限時間
