# 外部素材の出典

## 3D モデル（public/models/kit/）
| ファイル | 元パック | 作者 | ライセンス |
|---|---|---|---|
| kit/cars/police.glb | Car Kit 3.1 (police.glb) | Kenney (www.kenney.nl) | CC0（表記不要・商用可） |
| kit/houses/*.glb | City Kit (Suburban) 2.0 | Kenney | CC0 |
| kit/buildings/*.glb | City Kit (Commercial) 2.1 | Kenney | CC0 |

キャラクターのモデルは public/models/LICENSES.md、効果音は public/audio/se/SOURCES.md を参照。

## 音声（public/audio/voice/line_*.mp3）
| ファイル | 話者 | 生成方法 | ライセンス |
|---|---|---|---|
| line_bro_*.mp3 | VOICEVOX:青山龍星（熱血） | Web 版 VOICEVOX API（api.tts.quest）で生成。ピッチ +0.02、速さ 1.12、抑揚 1.5 | VOICEVOX 利用規約（クレジット「VOICEVOX:青山龍星」の表記が必要） |
| line_imouto_*.mp3 | VOICEVOX:満別花丸（元気） | 同上。ピッチ +0.03、速さ 1.1、抑揚 1.6 | VOICEVOX 利用規約（クレジット「VOICEVOX:満別花丸」の表記が必要） |

候補として試した別の声（採用時はクレジットを差し替える）：兄＝玄野武宏（喜び）、白上虎太郎（わーい）。妹＝猫使ビィ（ノーマル）、四国めたん（あまあま・抑揚 1.8）。

セリフの文言は src/config/game.ts の SPEECH、ファイル対応は src/config/voices.json（line.bro.* / line.imouto.*）。
作り直す時は同じ API に text と speaker（13=青山龍星、0=四国めたん あまあま、8=春日部つむぎ、3=ずんだもん）を渡す。
